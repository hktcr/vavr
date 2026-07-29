/* VävR: dokumentmodellen.
   Single Source of Truth är markdownsträngen. Allt annat räknas om.
   Ett block är antingen en rubrik med nivå eller ett stycke. */

let raknare = 0;

export function nyttId(prefix = 'b') {
  raknare += 1;
  return prefix + '-' + Date.now().toString(36) + '-' + raknare.toString(36);
}

export function nyttBlock(text = '', typ = 'stycke', niva = null) {
  return {
    id: nyttId('b'),
    typ: typ,
    niva: typ === 'rubrik' ? (niva || 1) : null,
    text: text,
    kommentarer: []
  };
}

export function nyttDokument(titel = 'Namnlöst') {
  const nu = new Date().toISOString();
  return {
    id: nyttId('d'),
    titel: titel,
    block: [],
    skapad: nu,
    andrad: nu,
    ljudtema: 'inget',
    doldaOrd: [],
    skrivmal: null,
    timer: null
  };
}

/* Läser en markdownrad och avgör om den är rubrik.
   Kräver mellanslag efter fyrkanterna, precis som CommonMark. */
export function lasRad(rad) {
  const m = /^(#{1,6})\s+(.*)$/.exec(rad);
  if (m) return { typ: 'rubrik', niva: m[1].length, text: m[2].trim() };
  return { typ: 'stycke', niva: null, text: rad.trim() };
}

/* Markdown in, blocklista ut. Tomma rader skiljer stycken.
   En rubrik bryter alltid, även utan tom rad efter. */
export function franMarkdown(md) {
  const block = [];
  const rader = String(md == null ? '' : md).split(/\r?\n/);
  let buffert = [];

  function tomBuffert() {
    if (buffert.length === 0) return;
    const text = buffert.join(' ').replace(/\s+/g, ' ').trim();
    if (text) block.push(nyttBlock(text, 'stycke'));
    buffert = [];
  }

  for (const rad of rader) {
    if (rad.trim() === '') { tomBuffert(); continue; }
    const l = lasRad(rad);
    if (l.typ === 'rubrik') {
      tomBuffert();
      block.push(nyttBlock(l.text, 'rubrik', l.niva));
    } else {
      buffert.push(l.text);
    }
  }
  tomBuffert();
  return block;
}

/* Blocklista ut till markdown. medKommentarer styr om kommentarer följer med.
   Kommentarer skrivs som blockquote direkt efter sitt block, så att
   upphovet är entydigt vid inklistring hos en AI eller i ett annat verktyg. */
export function tillMarkdown(block, medKommentarer = false) {
  const delar = [];
  for (const b of block) {
    if (b.typ === 'rubrik') {
      delar.push('#'.repeat(Math.min(6, Math.max(1, b.niva || 1))) + ' ' + b.text);
    } else {
      delar.push(b.text);
    }
    if (medKommentarer && b.kommentarer && b.kommentarer.length) {
      for (const k of b.kommentarer) {
        delar.push('> Kommentar: ' + String(k.text).replace(/\r?\n/g, ' '));
      }
    }
  }
  return delar.join('\n\n') + '\n';
}

/* Flyttar ett block till ett nytt index. Returnerar ny lista, muterar inte. */
export function flyttaBlock(block, franIndex, tillIndex) {
  const n = block.length;
  if (franIndex < 0 || franIndex >= n) return block.slice();
  const kopia = block.slice();
  const [b] = kopia.splice(franIndex, 1);
  const mal = Math.max(0, Math.min(kopia.length, tillIndex));
  kopia.splice(mal, 0, b);
  return kopia;
}

/* Sektioner: varje rubrik äger blocken fram till nästa rubrik av samma
   eller lägre nivå. Används av Trappan och av rubrikernas dragning i Väven. */
export function sektioner(block) {
  const ut = [];
  for (let i = 0; i < block.length; i++) {
    if (block[i].typ !== 'rubrik') continue;
    const niva = block[i].niva;
    let slut = block.length;
    for (let j = i + 1; j < block.length; j++) {
      if (block[j].typ === 'rubrik' && block[j].niva <= niva) { slut = j; break; }
    }
    ut.push({ rubrikId: block[i].id, niva: niva, fran: i, till: slut, barn: block.slice(i + 1, slut).map(b => b.id) });
  }
  return ut;
}

/* Närmaste föregående rubrik för varje block. null om inget finns. */
export function agare(block) {
  const karta = new Map();
  const stack = [];
  for (const b of block) {
    if (b.typ === 'rubrik') {
      while (stack.length && stack[stack.length - 1].niva >= b.niva) stack.pop();
      karta.set(b.id, stack.length ? stack[stack.length - 1].id : null);
      stack.push(b);
    } else {
      karta.set(b.id, stack.length ? stack[stack.length - 1].id : null);
    }
  }
  return karta;
}

export function statistik(block) {
  let tecken = 0, ord = 0, stycken = 0, rubriker = 0;
  for (const b of block) {
    tecken += b.text.length;
    const m = b.text.match(/[^\s]+/g);
    ord += m ? m.length : 0;
    if (b.typ === 'rubrik') rubriker += 1; else stycken += 1;
  }
  return { tecken, ord, stycken, rubriker, lastidMin: Math.max(1, Math.round(ord / 200)) };
}
