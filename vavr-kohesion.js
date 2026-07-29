/* VävR: kohesion mellan block.
   Metoden är tf-idf med cosinuslikhet, där varje block räknas som ett
   dokument och idf beräknas inom det aktuella dokumentet. Grunden är
   lexikal kohesion (Halliday och Hasan) och ordöverlapp mellan textblock
   som signal för ämnesgräns (TextTiling, Hearst 1997). Just den här
   visualiseringen är inte utvärderad någonstans, den är en designidé
   byggd på en beprövad mätning. Formuleringen är alltså ett förslag,
   inte ett vetenskapligt påstående om verktygets effekt. */

export const STOPPORD = new Set([
  'och','att','det','som','en','ett','på','är','av','för','med','till','den','har','de',
  'inte','om','men','var','jag','sig','så','vi','man','kan','när','han','hon','hans','hennes',
  'från','vid','eller','ska','skulle','kunde','blir','blev','vara','varit','vad','vem','vilken',
  'vilket','vilka','där','här','hur','alla','allt','andra','annan','annat','bara','bli','både',
  'denna','detta','dessa','dig','din','ditt','dina','du','efter','ej','emot','ena','endast',
  'ers','få','får','fick','fram','före','ge','genom','gick','gör','göra','hade','han','heller',
  'hennes','honom','icke','ingen','inget','inom','ju','just','kunna','kunnat','lika','likställd',
  'lilla','lite','längre','man','mellan','men','mera','mest','mig','min','mitt','mina','mot',
  'mycket','ner','nog','nu','någon','något','några','oss','över','redan','sedan','sin','sitt',
  'sina','själv','skall','ska','sköt','ta','tar','tog','under','upp','ut','utan','vad','var',
  'varit','varje','vars','vart','vem','vid','vidare','viss','vår','vårt','våra','än','ändå',
  'ännu','är','åt','över','också','samma','sådan','sådant','sådana','trots','därför','eftersom',
  'medan','än','then','the','and','of','to','in','is','it','that','this','for','with','as','be'
]);

/* Lätt suffixtrunkering för svenska. Detta är en heuristik, inte en riktig
   stemmer. Den fångar de vanligaste böjningarna utan att slå ihop ord som
   bara ser lika ut. Kravet på minst fyra tecken kvar hindrar de grövsta
   sammanslagningarna. En Snowball-port kan ersätta funktionen rakt av,
   kontraktet är sträng in och sträng ut. */
const SUFFIX = ['andet','ernas','arnas','ornas','andes','ande','erna','arna','orna','ernas',
                'ades','ande','aren','eten','erna','ers','ens','ets','arn','ade','are','ast',
                'het','en','et','ar','er','or','na','ns','as','es','s','t','a'];

export function normalisera(ord) {
  let o = ord.toLowerCase();
  for (const s of SUFFIX) {
    if (o.length - s.length >= 4 && o.endsWith(s)) return o.slice(0, o.length - s.length);
  }
  return o;
}

/* Plockar innehållsord ur en text. Returnerar en Map från normaliserad
   form till { tf, ytformer } där ytformer bevarar det som faktiskt skrevs
   så att ordlistan i sidopanelen kan visa riktiga ord, inte stammar. */
export function tokenisera(text, doldaOrd) {
  const dolda = doldaOrd instanceof Set ? doldaOrd : new Set(doldaOrd || []);
  const karta = new Map();
  const rader = String(text == null ? '' : text).toLowerCase();
  const traffar = rader.match(/[a-zåäöéüæø][a-zåäöéüæø-]*/g) || [];
  for (const rå of traffar) {
    if (rå.length < 3) continue;
    if (STOPPORD.has(rå) || dolda.has(rå)) continue;
    const nyckel = normalisera(rå);
    if (nyckel.length < 3) continue;
    if (dolda.has(nyckel)) continue;
    let post = karta.get(nyckel);
    if (!post) { post = { tf: 0, ytformer: new Map() }; karta.set(nyckel, post); }
    post.tf += 1;
    post.ytformer.set(rå, (post.ytformer.get(rå) || 0) + 1);
  }
  return karta;
}

/* Bygger idf över blocken. Utjämnad med log(1 + N/df) så att metoden
   fungerar även för dokument med bara två eller tre block, där ren
   log(N/df) skulle nolla ut varje ord som finns i alla block. */
export function byggIdf(blockKartor) {
  const N = blockKartor.length;
  const df = new Map();
  for (const karta of blockKartor) {
    for (const nyckel of karta.keys()) df.set(nyckel, (df.get(nyckel) || 0) + 1);
  }
  const idf = new Map();
  for (const [nyckel, n] of df) idf.set(nyckel, Math.log(1 + N / n));
  return { idf, df, N };
}

function vektor(karta, idf) {
  const v = new Map();
  let norm = 0;
  for (const [nyckel, post] of karta) {
    const vikt = (1 + Math.log(post.tf)) * (idf.get(nyckel) || 0);
    if (vikt <= 0) continue;
    v.set(nyckel, vikt);
    norm += vikt * vikt;
  }
  return { v, norm: Math.sqrt(norm) };
}

export function cosinus(a, b) {
  if (a.norm === 0 || b.norm === 0) return 0;
  const [liten, stor] = a.v.size <= b.v.size ? [a, b] : [b, a];
  let prickprodukt = 0;
  for (const [nyckel, vikt] of liten.v) {
    const annan = stor.v.get(nyckel);
    if (annan) prickprodukt += vikt * annan;
  }
  return prickprodukt / (a.norm * b.norm);
}

export const STANDARD = { troskel: 0.12, maxPerNod: 3 };

/* Huvudfunktionen. Tar blocklistan och returnerar noder, kanter och ordlista.
   Kostnaden är kvadratisk i antal block men varje jämförelse är liten:
   trehundra block ger 44 850 par och går på millisekunder. Det som kostar
   i verkligheten är kraftsimuleringen, inte den här beräkningen. */
export function berakna(block, alternativ) {
  const opt = Object.assign({}, STANDARD, alternativ || {});
  const dolda = new Set(opt.doldaOrd || []);
  const kartor = block.map(b => tokenisera(b.text, dolda));
  const { idf, df, N } = byggIdf(kartor);
  const vektorer = kartor.map(k => vektor(k, idf));

  const noder = block.map((b, i) => ({
    id: b.id,
    index: i,
    typ: b.typ,
    niva: b.niva,
    tecken: b.text.length,
    ord: (b.text.match(/[^\s]+/g) || []).length,
    unikaOrd: kartor[i].size,
    kohesion: 0,
    kohesionsgrad: 0,
    grannkohesion: 0,
    ensam: false,
    flodesbrott: false
  }));

  /* Sekvenskanter, dokumentordningen. Alltid alla, alltid starkast i ritningen. */
  const sekvens = [];
  for (let i = 0; i + 1 < block.length; i++) {
    sekvens.push({ a: block[i].id, b: block[i + 1].id, typ: 'sekvens', vikt: 1 });
  }

  /* Kohesionskanter. Alla par beräknas, sedan behålls topp maxPerNod per nod
     ovanför tröskeln. Rubriker deltar inte: de binder via hierarkin i stället. */
  const alla = [];
  for (let i = 0; i < block.length; i++) {
    if (block[i].typ === 'rubrik') continue;
    for (let j = i + 1; j < block.length; j++) {
      if (block[j].typ === 'rubrik') continue;
      const s = cosinus(vektorer[i], vektorer[j]);
      if (s >= opt.troskel) alla.push({ i, j, s });
    }
  }
  alla.sort((x, y) => y.s - x.s);

  const antal = new Map();
  const kohesion = [];
  for (const kant of alla) {
    const na = antal.get(kant.i) || 0;
    const nb = antal.get(kant.j) || 0;
    if (na >= opt.maxPerNod || nb >= opt.maxPerNod) continue;
    antal.set(kant.i, na + 1);
    antal.set(kant.j, nb + 1);
    kohesion.push({
      a: block[kant.i].id,
      b: block[kant.j].id,
      typ: 'kohesion',
      vikt: kant.s,
      avstand: kant.j - kant.i,
      delade: delade(kartor[kant.i], kartor[kant.j], idf, 5)
    });
  }

  /* Per nod två skilda signaler. Den första versionen slog ihop dem och
     testerna avslöjade felet: om ett främmande stycke ligger mitt i en
     text flaggades även dess två oskyldiga grannar, eftersom deras enda
     granne var främlingen. Signalerna betyder olika saker och ska visas
     olika:

     ensam       Noden har ingen kohesionskant alls i hela dokumentet.
                 Stycket hänger inte ihop med någonting. Stark signal,
                 ritas orange.

     flodesbrott Noden binder till dokumentet men inte till sina
                 sekvensgrannar. Stycket hör hemma i texten men står
                 antagligen på fel plats. Svag signal, ritas som en
                 tunn ring, och är underlaget till flyttförslaget. */
  for (const k of kohesion) {
    const na = noder.find(n => n.id === k.a);
    const nb = noder.find(n => n.id === k.b);
    if (na) { na.kohesion += k.vikt; na.kohesionsgrad += 1; }
    if (nb) { nb.kohesion += k.vikt; nb.kohesionsgrad += 1; }
  }
  for (const n of noder) {
    if (n.typ === 'rubrik') continue;
    let bast = 0;
    for (const d of [-1, 1]) {
      const g = noder[n.index + d];
      if (!g || g.typ === 'rubrik') continue;
      const s = cosinus(vektorer[n.index], vektorer[g.index]);
      if (s > bast) bast = s;
    }
    n.grannkohesion = bast;
    n.ensam = n.kohesionsgrad === 0;
    n.flodesbrott = !n.ensam && bast < opt.troskel;
  }

  return {
    noder,
    kanter: sekvens.concat(kohesion),
    ordlista: byggOrdlista(kartor, df, idf, block),
    metod: { troskel: opt.troskel, maxPerNod: opt.maxPerNod, blockAntal: N }
  };
}

function delade(a, b, idf, hogst) {
  const ut = [];
  for (const [nyckel, post] of a) {
    const annan = b.get(nyckel);
    if (!annan) continue;
    ut.push({ ord: vanligasteYtform(post, annan), vikt: (idf.get(nyckel) || 0) * Math.min(post.tf, annan.tf) });
  }
  ut.sort((x, y) => y.vikt - x.vikt);
  return ut.slice(0, hogst || 5).map(x => x.ord);
}

function vanligasteYtform(...poster) {
  const samlad = new Map();
  for (const p of poster) {
    for (const [form, n] of p.ytformer) samlad.set(form, (samlad.get(form) || 0) + n);
  }
  let bast = null, bastN = -1;
  for (const [form, n] of samlad) if (n > bastN) { bast = form; bastN = n; }
  return bast;
}

/* Ordlistan för sidopanelen. Sorterad på frekvens, med de block ordet
   förekommer i, så att ett klick kan tända rätt noder. */
export function byggOrdlista(kartor, df, idf, block) {
  const samlad = new Map();
  for (let i = 0; i < kartor.length; i++) {
    for (const [nyckel, post] of kartor[i]) {
      let rad = samlad.get(nyckel);
      if (!rad) {
        rad = { nyckel, ord: null, antal: 0, block: [], vikt: idf.get(nyckel) || 0, ytformer: new Map() };
        samlad.set(nyckel, rad);
      }
      rad.antal += post.tf;
      rad.block.push(block[i].id);
      for (const [form, n] of post.ytformer) rad.ytformer.set(form, (rad.ytformer.get(form) || 0) + n);
    }
  }
  const ut = [];
  for (const rad of samlad.values()) {
    rad.ord = vanligasteYtform({ ytformer: rad.ytformer });
    rad.iAntalBlock = df.get(rad.nyckel) || rad.block.length;
    delete rad.ytformer;
    ut.push(rad);
  }
  ut.sort((a, b) => b.antal - a.antal || a.ord.localeCompare(b.ord, 'sv'));
  return ut;
}
