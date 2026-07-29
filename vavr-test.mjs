/* VävR: tester. Kör med `node vavr-test.mjs`. Inga beroenden.
   Varje kontroll skriver ut sitt utfall. Sista raden är sammanfattningen.
   Kör detta före varje commit, tillsammans med `node --check` på varje fil. */

import {
  franMarkdown, tillMarkdown, nyttBlock, nyttDokument, flyttaBlock,
  sektioner, agare, statistik, lasRad
} from './vavr-dokument.js';
import {
  tokenisera, normalisera, byggIdf, cosinus, berakna, STOPPORD
} from './vavr-kohesion.js';
import { TextContext, fullSkanning } from './vavr-textcontext.js';

let ok = 0, fel = 0;
function pa(villkor, namn, extra) {
  if (villkor) { ok++; console.log('  ok   ' + namn); }
  else { fel++; console.log('  FEL  ' + namn + (extra !== undefined ? '  <- ' + JSON.stringify(extra) : '')); }
}
function nara(a, b, tol, namn) { pa(Math.abs(a - b) <= tol, namn, { a, b }); }

console.log('\n── Dokumentmodellen ──');

const md = [
  '# Sträcket över Bjärehalvön',
  '',
  'Tryckfallet kom in från sydväst under natten. Vid gryningen låg ett tunt lager stratus över Skälderviken.',
  '',
  'Klockan fem stod de första flockarna högt. Ejder mest, i låga band längs kusten.',
  '',
  '## Tryckets roll',
  '',
  'Barometern förklarar inte allt, men den förklarar tidpunkten. Ett fallande tryck ger medvind och sikt.',
  '',
  '# Vad räkningarna missar',
  '',
  'Standardprotokollet räknar det som passerar inom synhåll. Allt över molnbasen faller utanför.'
].join('\n');

const block = franMarkdown(md);
pa(block.length === 7, 'sju block ur exempeltexten', block.length);
pa(block[0].typ === 'rubrik' && block[0].niva === 1, 'första blocket är rubrik nivå 1');
pa(block[3].typ === 'rubrik' && block[3].niva === 2, 'fjärde blocket är rubrik nivå 2');
pa(block[1].typ === 'stycke', 'andra blocket är stycke');
pa(block.every(b => b.id && b.id !== block[0].id || b === block[0]), 'alla block har id');
pa(new Set(block.map(b => b.id)).size === block.length, 'alla id är unika');

pa(lasRad('### Tre').niva === 3, 'tre fyrkanter ger nivå 3');
pa(lasRad('#Utan mellanslag').typ === 'stycke', 'fyrkant utan mellanslag är inte rubrik');
pa(lasRad('####### Sju').typ === 'stycke', 'sju fyrkanter är inte rubrik');

const rundtur = franMarkdown(tillMarkdown(block));
pa(rundtur.length === block.length, 'rundtur bevarar antal block');
pa(rundtur.every((b, i) => b.typ === block[i].typ && b.niva === block[i].niva && b.text === block[i].text),
   'rundtur bevarar typ, nivå och text');

const medK = block.map(b => Object.assign({}, b));
medK[1] = Object.assign({}, medK[1], { kommentarer: [{ id: 'k1', text: 'Kolla SMHI-datum här.' }] });
const utanK = tillMarkdown(medK, false);
const medKtext = tillMarkdown(medK, true);
pa(!utanK.includes('Kommentar'), 'export utan kommentarer utesluter dem');
pa(medKtext.includes('> Kommentar: Kolla SMHI-datum här.'), 'export med kommentarer använder rätt prefix');
pa(franMarkdown(medKtext).length === block.length + 1, 'kommentaren blir eget block vid återläsning, som väntat');

const flyttad = flyttaBlock(block, 2, 5);
pa(flyttad.length === block.length, 'flytt bevarar antal');
pa(flyttad[5].id === block[2].id, 'flyttat block hamnar på rätt index');
pa(block[2].id !== flyttad[2].id, 'originallistan muteras inte');

const sekt = sektioner(block);
pa(sekt.length === 3, 'tre sektioner', sekt.length);
pa(sekt[0].barn.length === 4, 'första nivå-1-sektionen äger fyra block', sekt[0].barn.length);
pa(sekt[1].niva === 2 && sekt[1].barn.length === 1, 'nivå-2-sektionen äger ett stycke');

const ag = agare(block);
pa(ag.get(block[4].id) === block[3].id, 'stycket under nivå-2-rubriken ägs av den');
pa(ag.get(block[3].id) === block[0].id, 'nivå-2-rubriken ägs av nivå-1-rubriken');
pa(ag.get(block[0].id) === null, 'första rubriken har ingen ägare');

const st = statistik(block);
pa(st.rubriker === 3 && st.stycken === 4, 'statistik räknar rubriker och stycken', st);
pa(st.ord > 60 && st.ord < 120, 'ordantalet ligger i rimligt intervall', st.ord);

console.log('\n── Tokenisering och normalisering ──');

pa(normalisera('fåglarna').length >= 4, 'normalisering behåller minst fyra tecken', normalisera('fåglarna'));
pa(normalisera('fågel') === normalisera('fågel'), 'normalisering är deterministisk');
pa(normalisera('tryck') === 'tryck', 'korta ord lämnas orörda');
pa(STOPPORD.has('och') && STOPPORD.has('att'), 'stopplistan innehåller de vanligaste orden');

const t1 = tokenisera('Tryckfallet kom in från sydväst. Trycket föll snabbt.', []);
pa(!t1.has('och'), 'stoppord filtreras bort');
pa([...t1.keys()].every(k => k.length >= 3), 'inga tokens kortare än tre tecken');

/* Sammansättningen tryckfallet och enkelordet trycket ska hålla sig åtskilda.
   En stemmer som slog ihop dem skulle skapa falska kopplingar. */
pa(t1.has('tryckfall') && t1.has('tryck'), 'sammansättning och enkelord får skilda stammar', [...t1.keys()]);

/* Verklig böjning av samma ord ska däremot samlas. */
const t1b = tokenisera('Trycket föll. Tryck steg. Trycken varierade.', []);
pa(t1b.has('tryck') && t1b.get('tryck').tf === 3, 'trycket, tryck och trycken samlas till en stam', [...t1b.entries()].map(([k, v]) => k + ':' + v.tf));
pa(t1b.get('tryck').ytformer.size === 3, 'alla tre ytformer bevaras för ordlistan', [...t1b.get('tryck').ytformer.keys()]);

const t2 = tokenisera('Tryckfallet kom in från sydväst.', ['tryckfallet']);
pa(![...t2.keys()].some(k => k.startsWith('tryckfall')), 'dolt ord utesluts ur tokeniseringen');

console.log('\n── Kohesion ──');

const idfData = byggIdf([tokenisera('fågel sträck tryck', []), tokenisera('fågel moln sikt', [])]);
pa(idfData.N === 2, 'idf ser båda blocken');
const idfFagel = idfData.idf.get(normalisera('fågel'));
const idfStrack = idfData.idf.get(normalisera('sträck'));
pa(idfFagel > 0, 'ord i alla block får ändå vikt över noll, tack vare utjämningen', idfFagel);
pa(idfStrack > idfFagel, 'ord i ett enda block väger mer än ord i alla', { idfStrack, idfFagel });

const resultat = berakna(block, {});
pa(resultat.noder.length === block.length, 'en nod per block');
pa(resultat.kanter.filter(k => k.typ === 'sekvens').length === block.length - 1,
   'sekvenskanterna är antalet block minus ett');
pa(resultat.kanter.filter(k => k.typ === 'kohesion').every(k => k.vikt >= resultat.metod.troskel),
   'alla kohesionskanter ligger på eller över tröskeln');
pa(resultat.kanter.filter(k => k.typ === 'kohesion').every(k => {
  const a = resultat.noder.find(n => n.id === k.a);
  const b = resultat.noder.find(n => n.id === k.b);
  return a.typ === 'stycke' && b.typ === 'stycke';
}), 'rubriker deltar inte i kohesionskanterna');

const antalPerNod = new Map();
for (const k of resultat.kanter.filter(k => k.typ === 'kohesion')) {
  antalPerNod.set(k.a, (antalPerNod.get(k.a) || 0) + 1);
  antalPerNod.set(k.b, (antalPerNod.get(k.b) || 0) + 1);
}
pa([...antalPerNod.values()].every(n => n <= resultat.metod.maxPerNod),
   'ingen nod har mer än maxPerNod kohesionskanter', [...antalPerNod.values()]);

/* Ett stycke som inte delar vokabulär med sina grannar ska flaggas ensamt. */
const medFramling = franMarkdown([
  'Tryckfallet kom in från sydväst och tryckets rörelse fortsatte natten ut.',
  '',
  'Zebror betar på savannen i flock och zebrans strimmor förvirrar rovdjuren.',
  '',
  'Trycket steg igen mot morgonen och tryckfallet var över.'
].join('\n'));
const rf = berakna(medFramling, {});
pa(rf.noder[1].ensam === true, 'främmande stycke flaggas som ensamt', rf.noder[1]);
pa(rf.noder[0].ensam === false, 'granne till främlingen flaggas inte som ensam', rf.noder[0]);
pa(rf.noder[2].ensam === false, 'andra grannen flaggas inte heller som ensam', rf.noder[2]);
pa(rf.noder[0].flodesbrott === true, 'grannen flaggas i stället för flödesbrott, den binder till annat håll', rf.noder[0]);
pa(rf.noder[1].flodesbrott === false, 'ensam nod får inte samtidigt flödesbrott, signalerna utesluter varandra');
pa(rf.noder[0].kohesionsgrad > 0, 'grannen har kohesionskanter i dokumentet', rf.noder[0].kohesionsgrad);
pa(rf.noder[1].kohesionsgrad === 0, 'främlingen har inga kohesionskanter alls', rf.noder[1].kohesionsgrad);

/* En sammanhängande text ska inte flagga någonting. Det är det viktigaste
   testet: ett verktyg som varnar hela tiden är ett verktyg som ignoreras. */
const sammanhangande = franMarkdown([
  'Trycket föll under natten och tryckfallet fortsatte in mot gryningen.',
  '',
  'Vid gryningen hade trycket stabiliserats och sikten över viken var god.',
  '',
  'God sikt och stabilt tryck är den kombination som sträcket tycks vänta in.'
].join('\n'));
const rs = berakna(sammanhangande, {});
pa(rs.noder.every(n => !n.ensam), 'sammanhängande text flaggar ingen nod som ensam',
   rs.noder.map(n => n.ensam));
pa(rs.noder.every(n => !n.flodesbrott), 'sammanhängande text flaggar inget flödesbrott',
   rs.noder.map(n => ({ g: Number(n.grannkohesion.toFixed(3)), b: n.flodesbrott })));

const cosSelv = (() => {
  const k = tokenisera('tryck fågel sträck moln', []);
  const { idf } = byggIdf([k, tokenisera('helt andra ord här', [])]);
  const v = (function () {
    const vv = new Map(); let norm = 0;
    for (const [n, p] of k) { const w = (1 + Math.log(p.tf)) * (idf.get(n) || 0); if (w > 0) { vv.set(n, w); norm += w * w; } }
    return { v: vv, norm: Math.sqrt(norm) };
  })();
  return cosinus(v, v);
})();
nara(cosSelv, 1, 1e-9, 'cosinuslikheten mot sig själv är ett');
pa(cosinus({ v: new Map(), norm: 0 }, { v: new Map(), norm: 0 }) === 0, 'tom vektor ger noll, ingen division med noll');

pa(resultat.ordlista.length > 0, 'ordlistan är inte tom');
pa(resultat.ordlista.every((r, i, a) => i === 0 || a[i - 1].antal >= r.antal), 'ordlistan är sorterad på frekvens');
pa(resultat.ordlista.every(r => r.ord && r.block.length > 0), 'varje ordrad bär en ytform och minst ett block');
pa(resultat.ordlista.every(r => r.block.every(id => block.some(b => b.id === id))), 'ordlistans blockreferenser pekar på riktiga block');

const tomt = berakna([], {});
pa(tomt.noder.length === 0 && tomt.kanter.length === 0, 'tomt dokument kraschar inte');
const ettBlock = berakna([nyttBlock('Ett enda stycke utan grannar alls.')], {});
pa(ettBlock.kanter.length === 0, 'ett enda block ger inga kanter');

console.log('\n── TextContext ──');

TextContext.setKalla(() => md);
const s = TextContext.getStats();
pa(s.N > 300, 'N räknar bokstäverna i hela dokumentet', s.N);
pa(s.words === s.wordCount, 'fältet words finns och matchar wordCount', { words: s.words, wordCount: s.wordCount });
pa(Number.isFinite(s.words) && s.words > 0, 'words är ett tal, inte undefined. Detta var buggen i SkrivR', s.words);
pa(s.headings === 3, 'tre rubriker hittas', s.headings);
pa(s.lastHeadingLevel === 1, 'senaste rubriknivån är ett', s.lastHeadingLevel);
pa(s.harmonicShiftCount === 5, 'harmoniska skiften: två per nivå ett, ett per nivå två', s.harmonicShiftCount);
nara(s.g, 40 / (40 + s.N), 1e-12, 'tröghetslagen g = 40/(40+N) håller');
pa(s.g > 0 && s.g < 1, 'g ligger mellan noll och ett', s.g);
pa(s.vowelRatio > 0.25 && s.vowelRatio < 0.55, 'vokalandelen är rimlig för svenska', s.vowelRatio);
pa(s.lix > 20 && s.lix < 80, 'lix ligger i ett rimligt intervall', s.lix);
pa(s.meanAlpha > 0 && s.meanAlpha < 29, 'meanAlpha ligger inom alfabetets index', s.meanAlpha);
pa(s.section_vowelRatio > 0, 'sektionsstatistiken är beräknad', s.section_vowelRatio);

/* Alla fält som motorerna faktiskt läser måste finnas och vara tal.
   Listan är hämtad ur valsang-, skogsklang-, hardfork- och space-engine. */
const kravda = ['N', 'g', 'harmonicShiftCount', 'lastHeadingLevel', 'meanAlpha',
                'meanSentLen', 'paragraphs', 'section_vowelRatio', 'vowelRatio', 'words'];
for (const f of kravda) pa(typeof s[f] === 'number' && Number.isFinite(s[f]), 'motorkontraktet: ' + f + ' är ett tal', s[f]);

TextContext.setKalla(() => '');
const tomStats = TextContext.getStats();
pa(tomStats.N === 0 && tomStats.g === 1 && tomStats.lix === 0, 'tom text ger nollställda värden utan NaN', tomStats.g);
pa(Number.isFinite(tomStats.meanWordLen), 'meanWordLen faller tillbaka på standardvärde vid tom text', tomStats.meanWordLen);

TextContext.setKalla(() => '#Ingen rubrik utan mellanslag');
pa(TextContext.getStats().headings === 0, 'fyrkant utan mellanslag räknas inte som rubrik');
TextContext.setKalla(() => '###### Sex nivåer');
pa(TextContext.getStats().lastHeadingLevel === 6, 'sex fyrkanter ger nivå sex');
TextContext.setKalla(() => '####### Sju nivåer');
pa(TextContext.getStats().headings === 0, 'sju fyrkanter räknas inte som rubrik');
TextContext.frigor();

console.log('\n── Sammanfattning ──');
console.log('  ' + ok + ' godkända, ' + fel + ' fel av ' + (ok + fel) + ' kontroller\n');
if (fel > 0) process.exit(1);
