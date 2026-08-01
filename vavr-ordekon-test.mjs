import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const sandbox = { console, Intl };
vm.createContext(sandbox);
vm.runInContext(readFileSync('ordekon-kelly.js', 'utf8'), sandbox);
vm.runInContext(readFileSync('ordekon-engine.js', 'utf8'), sandbox);

const Ordekon = sandbox.Ordekon;
let passed = 0;
let failed = 0;

function check(condition, label, detail = '') {
  if (condition) {
    passed += 1;
    console.log('  ok   ' + label);
  } else {
    failed += 1;
    console.log('  FEL  ' + label + (detail ? '  <- ' + JSON.stringify(detail) : ''));
  }
}

function block(id, text, kind = 'paragraph') {
  return { id, text, kind, level: kind === 'heading' ? 1 : null };
}

console.log('\nOrdekon: referens och ord');

check(Boolean(Ordekon), 'Ordekon laddas som lokal motor');
const basic = Ordekon.analyze([
  block('b1', 'Kvantflöde kvantflöde kvantflöde kvantflöde. Och och och och. Trycket steg.'),
  block('b2', 'Tryck och trycken förändrades. Ett engångsord står ensamt här.'),
  block('b3', 'Texten fylls ut med lugna ord så att analysunderlaget blir tillräckligt stort för en försiktig jämförelse.')
]);

check(basic.method.referenceEntries === 5019, 'den kompakta Kelly-referensen har förväntat antal poster', basic.method.referenceEntries);
check(basic.method.referenceLicense === 'CC-BY-4.0', 'referenslicensen redovisas');
const uncommon = basic.words.find(item => item.key === 'kvantflöde');
const common = basic.words.find(item => item.key === 'och');
check(uncommon?.count === 4, 'ett återkommande ovanligt ord hittas', uncommon?.count);
check(common?.count === 5, 'vanligt småord finns kvar i analysen', common?.count);
check(uncommon?.score > common?.score, 'ovanligt ord väger mer än vanligare ord trots färre träffar', { uncommon: uncommon?.score, common: common?.score });
check(!basic.words.some(item => item.label === 'engångsord'), 'ovanligt engångsord förstoras inte');

const irregularCommon = Ordekon.analyze([
  block('f1', 'Är är är är. Kvantflöde kvantflöde kvantflöde kvantflöde.'),
  block('f2', 'Lugna utfyllnadsord ger analysen ett större underlag och en rimligare försiktig jämförelse mellan uttrycken i texten.'),
  block('f3', 'Ytterligare ord beskriver en stilla rörelse genom rummet utan att upprepa de två uttryck som jämförs.')
]);
const ar = irregularCommon.words.find(item => item.key === 'är');
const irregularRare = irregularCommon.words.find(item => item.key === 'kvantflöde');
check(
  ar?.frequency.commonFallback === true && irregularRare?.score > ar?.score,
  'vanligt böjt formord utan direkt lemmaträff nedviktas försiktigt',
  { common: ar, rare: irregularRare }
);

const tryck = basic.words.find(item => item.key === Ordekon.normalizeWord('tryck'));
check(tryck?.count === 3, 'försiktig normalisering samlar tryck, trycket och trycken', tryck?.forms);
check(tryck?.forms.length === 3, 'de faktiska ordformerna bevaras', tryck?.forms);
check(tryck?.occurrences.every(item => {
  const source = item.blockId === 'b1'
    ? 'Kvantflöde kvantflöde kvantflöde kvantflöde. Och och och och. Trycket steg.'
    : 'Tryck och trycken förändrades. Ett engångsord står ensamt här.';
  return source.slice(item.start, item.end).toLocaleLowerCase('sv-SE') === item.surface.toLocaleLowerCase('sv-SE');
}), 'ordträffarnas teckenpositioner pekar på rätt text');
check(basic.words.every(item => Number.isInteger(item.stableOrder)), 'ordfältets stabila ordning är deterministisk');

console.log('\nOrdekon: fraser');

const phraseAnalysis = Ordekon.analyze([
  block('p1', 'Den kalla vinden steg snabbt. På nytt kom regnet.'),
  block('p2', 'Den kalla vinden steg långsamt. På nytt kom ljuset.'),
  block('p3', 'På nytt kom regnet. Den kalla vinden steg återigen.'),
  block('p4', 'Månen sjönk. Havet steg. Månen sjönk. Havet steg.'),
  block('p5', 'Fler ord läggs till så att dokumentet ger ett lugnt och tillräckligt analysunderlag för metoden.')
]);

const longPhrase = phraseAnalysis.phrases.find(item => item.key === 'den kall vind steg');
check(longPhrase?.length === 4 && longPhrase.count === 3, 'upprepad fyrordsfras hittas', longPhrase);
check(!phraseAnalysis.phrases.some(item => item.key === 'den kall'), 'kort delfras döljs när den alltid ingår i en längre träff');
check(phraseAnalysis.phrases.some(item => item.key === 'på nytt kom' && item.count === 3), 'den längsta återkommande frasen behålls');
check(!phraseAnalysis.phrases.some(item => item.key.includes('sjönk hav')), 'fraser skapas inte över meningsgränser');

console.log('\nOrdekon: meningsstarter');

const starterAnalysis = Ordekon.analyze([
  block('s1', 'Jag kunde inte se stranden. Jag kunde inte höra båten.'),
  block('s2', 'Jag kunde inte ana fyren. Resten av texten ger analysen fler ord utan att upprepa samma öppning.'),
  block('s3', 'Ett tredje stycke fyller ut underlaget med stilla observationer från havet och den mörka himlen.')
]);
const starter = starterAnalysis.starters.find(item => item.key === 'jag kunde inte');
check(starter?.count === 3, 'återkommande meningsstart hittas separat', starter);
check(starterAnalysis.starters.every(item => item.type === 'starter'), 'meningsstarter hålls skilda från fraser');

console.log('\nOrdekon: försiktighet och stabilitet');

const filler = 'alfa beta gamma delta epsilon zeta eta theta iota kappa lambda my';
const clustered = Ordekon.analyze([
  block('c1', 'eko eko eko eko eko ' + filler.repeat(8)),
  block('c2', filler.repeat(8))
]).words.find(item => item.key === 'eko');
const spread = Ordekon.analyze([
  block('d1', 'eko ' + filler.repeat(3)),
  block('d2', 'eko ' + filler.repeat(3)),
  block('d3', 'eko ' + filler.repeat(3)),
  block('d4', 'eko ' + filler.repeat(3)),
  block('d5', 'eko ' + filler.repeat(3))
]).words.find(item => item.key === 'eko');
check(clustered?.cluster.value > spread?.cluster.value, 'lokal anhopning skiljs från spridd upprepning', { clustered: clustered?.cluster, spread: spread?.cluster });
check(clustered?.score / spread?.score <= 1.250001, 'anhopning kan höja signalen med högst 25 procent', { clustered: clustered?.score, spread: spread?.score });

const again = Ordekon.analyze([
  block('b1', 'Kvantflöde kvantflöde kvantflöde kvantflöde. Och och och och. Trycket steg.'),
  block('b2', 'Tryck och trycken förändrades. Ett engångsord står ensamt här.'),
  block('b3', 'Texten fylls ut med lugna ord så att analysunderlaget blir tillräckligt stort för en försiktig jämförelse.')
]);
check(
  JSON.stringify(again.words.map(item => [item.id, item.score, item.stableOrder])) ===
  JSON.stringify(basic.words.map(item => [item.id, item.score, item.stableOrder])),
  'samma text ger exakt samma Ordekonfält'
);
check(Ordekon.analyze([block('kort', 'Tre mycket korta ord.')]).insufficient, 'kort dokument märks som otillräckligt underlag');
check(!basic.insufficient, 'tillräckligt långt dokument kan analyseras');

console.log(`\n${passed} godkända, ${failed} fel`);
if (failed) process.exitCode = 1;
