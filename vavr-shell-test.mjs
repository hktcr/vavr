import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync('index.html', 'utf8');
const manifest = JSON.parse(readFileSync('manifest.webmanifest', 'utf8'));
const worker = readFileSync('sw.js', 'utf8');
const valsangEngine = readFileSync('valsang-engine.js', 'utf8');
const hardForkEngine = readFileSync('hardfork-engine.js', 'utf8');
let passed = 0;
let failed = 0;

function check(condition, label, detail = '') {
  if (condition) {
    passed += 1;
    console.log('  ok   ' + label);
  } else {
    failed += 1;
    console.log('  FEL  ' + label + (detail ? '  <- ' + detail : ''));
  }
}

function pngSize(path) {
  const bytes = readFileSync(path);
  const signature = bytes.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') return null;
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20)
  };
}

console.log('\nPWA-skal');

check(/<link rel="manifest" href="\.\/manifest\.webmanifest">/.test(html), 'manifestet är länkat');
check(/<link rel="apple-touch-icon" href="\.\/icons\/vavr-180\.png"/.test(html), 'Apple-ikonen är länkad');
const scriptSources = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]);
check(
  JSON.stringify(scriptSources) === JSON.stringify(['./valsang-engine.js', './hardfork-engine.js']),
  'endast de två lokala SkrivR-motorerna laddas'
);
check(!/@import\s|<link[^>]+rel="stylesheet"/.test(html), 'inga externa stilmallar används');

const inlineScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
check(Boolean(inlineScript), 'inline-skriptet finns');
try {
  new vm.Script(inlineScript);
  check(true, 'inline-skriptet har giltig syntax');
} catch (error) {
  check(false, 'inline-skriptet har giltig syntax', error.message);
}

try {
  new vm.Script(worker);
  check(true, 'service workern har giltig syntax');
} catch (error) {
  check(false, 'service workern har giltig syntax', error.message);
}

for (const [name, source] of [
  ['Valsångsmotorn', valsangEngine],
  ['Hard Fork-motorn', hardForkEngine]
]) {
  try {
    new vm.Script(source);
    check(true, name + ' har giltig syntax');
  } catch (error) {
    check(false, name + ' har giltig syntax', error.message);
  }
}

check(manifest.id === './', 'manifestets id är scope-relativt');
check(manifest.start_url === './', 'startadressen är scope-relativ');
check(manifest.scope === './', 'manifestets scope är relativt');
check(manifest.display === 'standalone', 'installerat läge är standalone');
check(manifest.theme_color === '#090b11' && manifest.background_color === '#090b11', 'manifestfärgerna matchar VävR');
check(Array.isArray(manifest.icons) && manifest.icons.length === 3, 'manifestet har tre ikonposter');

for (const icon of manifest.icons) {
  const path = icon.src.replace(/^\.\//, '');
  const expected = Number(icon.sizes.split('x')[0]);
  const size = existsSync(path) ? pngSize(path) : null;
  check(Boolean(size), path + ' finns och är PNG');
  check(size?.width === expected && size?.height === expected, path + ' har rätt mått');
  const resolved = new URL(icon.src, 'https://hktcr.github.io/vavr/manifest.webmanifest');
  check(resolved.pathname.startsWith('/vavr/icons/'), path + ' stannar inom GitHub Pages-scope');
}

const appleSize = pngSize('icons/vavr-180.png');
check(appleSize?.width === 180 && appleSize?.height === 180, 'Apple-ikonen är 180 gånger 180');
check(worker.includes("const CACHE_PREFIX = 'vavr-shell-'"), 'cache-rensningen har projektspecifikt prefix');
check(worker.includes("event.waitUntil(self.skipWaiting())"), 'uppdateringsmeddelandet hålls vid liv');
check(worker.includes("new URL('./index.html', self.registration.scope)"), 'offlineindex byggs från worker-scope');
check(worker.includes("'./valsang-engine.js'"), 'Valsångsmotorn ingår i offlinecachen');
check(worker.includes("'./hardfork-engine.js'"), 'Hard Fork-motorn ingår i offlinecachen');

console.log('\nSkrivstöd och Vävbord');

for (const id of [
  'goal-enabled',
  'goal-progress',
  'timer-display',
  'timer-primary',
  'writing-support-summary',
  'graph-lens',
  'graph-lens-status',
  'vavbord-toolbar',
  'vavbord-dock',
  'vavbord-document-list',
  'tension-lens',
  'structure-breadcrumb',
  'structure-board',
  'structure-heading-editor',
  'device-settings',
  'install-nudge'
]) {
  check(html.includes(`id="${id}"`), '#' + id + ' finns');
}

check(html.includes("metric: 'words'"), 'ordmål finns i datamodellen');
check(html.includes("source.metric === 'characters'"), 'teckenmål normaliseras');
check(html.includes("endAt: Date.now() + durationSec * 1000"), 'timern använder absolut sluttid');
check(html.includes('function buildStructureTree'), 'sektionsträdet härleds');
check(html.includes('function beginContextualWriting'), 'kontextuell infogning finns');
check(html.includes('function beginWritingAt'), 'Skrivsömmen kan placera nästa block exakt');
check(html.includes('function spineCard'), 'hela manusryggraden renderas som en redigerbar lista');
check(html.includes('function switchVavbordView'), 'Lista och Noder är två lägen i samma Vävbord');
check(html.includes("vavbordView: 'list'"), 'Vävbordets lugna standardläge är Lista');
check(html.includes("stored.settings.vavbordView === 'nodes' ? 'nodes' : 'list'"), 'sparat Vävbordsläge normaliseras');
check(html.includes('function downloadBackup'), 'säkerhetskopiering finns');
check(html.includes("window.addEventListener('beforeinstallprompt'"), 'Chromiums installationssignal hanteras');

const widthsSource = inlineScript?.match(/const WIDTHS = \[[^\n]+\];/)?.[0];
const normalizeWidthSource = inlineScript?.match(
  /const normalizeWidthIndex = value => \{[\s\S]*?^    \};/m
)?.[0];
if (widthsSource && normalizeWidthSource) {
  const widthSandbox = {};
  vm.runInNewContext(`
    ${widthsSource}
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    ${normalizeWidthSource}
    globalThis.widthResults = [
      normalizeWidthIndex(-1),
      normalizeWidthIndex(2.5),
      normalizeWidthIndex(999),
      normalizeWidthIndex(null),
      normalizeWidthIndex(''),
      normalizeWidthIndex('ogiltigt')
    ];
  `, widthSandbox);
  check(
    JSON.stringify(widthSandbox.widthResults) === JSON.stringify([0, 3, 7, 2, 2, 2]),
    'breddindex klampas, avrundas och får säker reservnivå'
  );
} else {
  check(false, 'breddindex klampas, avrundas och får säker reservnivå');
}

console.log('\nLjudrum');

for (const id of [
  'sound-button',
  'sound-settings',
  'sound-theme',
  'sound-reactive',
  'sound-volume',
  'sound-toggle',
  'typewriter-theme',
  'typewriter-volume',
  'typewriter-toggle'
]) {
  check(html.includes(`id="${id}"`), '#' + id + ' finns');
}

for (const theme of [
  'glantan',
  'regnvav',
  'djupstrom',
  'nattljus',
  'ordfalt',
  'sambandsvav',
  'strukturklang',
  'valsang',
  'hardfork'
]) {
  check(html.includes(`${theme}: {`), 'ljudtemat ' + theme + ' finns');
}

for (const theme of ['mekanisk', 'reseskrivare', 'elektrisk', 'dampad']) {
  check(html.includes(`${theme}: {`), 'skrivmaskinsljudet ' + theme + ' finns');
}

check(
  html.includes('window.AudioContext || window.webkitAudioContext'),
  'ljudmotorn använder Web Audio med Safari-fallback'
);
check(html.includes("soundTheme: 'none'"), 'ljud är av som standard');
check(html.includes('Soundscape.commit(block.kind)'), 'invävda block kan påverka ljudrummet');
check(html.includes('Soundscape.updateText(soundTextProfile())'), 'ljudbilden kan följa hela textprofilen');
check(html.includes('Typewriter.handleKey(key)'), 'skrivfältet skickar tangenter till skrivmaskinsmotorn');
check(html.includes("elements.draft.addEventListener('beforeinput'"), 'iOS-inmatning kan ge tangentljud via beforeinput');
check(html.includes('createSampleBank(context, profiles[theme])'), 'skrivmaskinsljuden förbereds före tangenttryckning');
check(html.includes("latencyHint: 'interactive'"), 'ljudkontexterna begär interaktiv latens');
check(
  /id="sound-volume"[^>]+max="100"/.test(html) &&
  /id="typewriter-volume"[^>]+max="100"/.test(html),
  'båda volymreglagen når den nya maxnivån'
);
check(html.includes('await startSound();'), 'val av ljudlandskap startar det direkt');
check(html.includes('await startTypewriter();'), 'val av skrivmaskinstema aktiverar det direkt');
check(html.includes('Typewriter.preview();'), 'skrivmaskinsvalet ger ett provslag');
check(html.includes("soundReady ? 'Spelar ' : 'Startar '"), 'gränssnittet visar väntande ljudstart');
check(
  html.includes('Soundscape.stop(true);') && html.includes('Typewriter.stop(true);'),
  'ljudmotorerna stängs när sidan lämnas'
);
check(
  html.includes('window.ValsangEngine') && html.includes('window.HardForkEngine'),
  'VävR kopplar in de fullständiga SkrivR-motorerna'
);
check(
  valsangEngine.includes('voiceOsc1') &&
  valsangEngine.includes('voiceOsc2') &&
  valsangEngine.includes('subOsc') &&
  valsangEngine.includes('playEchoPhrase') &&
  valsangEngine.includes('songLFO'),
  'Valsång bevarar dubbelröst, subröst, frasminne och långsam tonböjning'
);
check(
  hardForkEngine.includes('const BPM = 125') &&
  hardForkEngine.includes('function playKick') &&
  hardForkEngine.includes('function playBass') &&
  hardForkEngine.includes('function playHat') &&
  hardForkEngine.includes('function playSnare') &&
  hardForkEngine.includes('function scheduleStep'),
  'Hard Fork bevarar sequencer, bas och trumproduktion'
);
check(
  hardForkEngine.includes('Direktansatsen tar bort upplevd tangentfördröjning'),
  'Hard Fork har direkt tangentansats ovanpå rytmnätet'
);

const sendSoundSource = inlineScript?.match(
  /function sendDraftSound\(key, origin = 'direct'\) \{[\s\S]*?^    \}/m
)?.[0];
if (sendSoundSource) {
  const soundEvents = [];
  const soundEventSandbox = {
    performance: { now: () => soundEventSandbox.time },
    time: 0,
    characterCount: text => Array.from(text).length,
    Soundscape: { handleKey: key => soundEvents.push('s:' + key) },
    Typewriter: { handleKey: key => soundEvents.push('t:' + key) }
  };
  vm.runInNewContext(`
    let recentPhysicalSoundKeys = [];
    ${sendSoundSource}
    globalThis.sendDraftSound = sendDraftSound;
  `, soundEventSandbox);
  soundEventSandbox.sendDraftSound('a', 'keydown');
  soundEventSandbox.time = 110;
  soundEventSandbox.sendDraftSound('a', 'beforeinput');
  soundEventSandbox.time = 120;
  soundEventSandbox.sendDraftSound('b', 'beforeinput');
  soundEventSandbox.time = 130;
  soundEventSandbox.sendDraftSound('Shift', 'keydown');
  check(
    JSON.stringify(soundEvents) === JSON.stringify(['s:a', 't:a', 's:b', 't:b']),
    'sent iOS-beforeinput dedupliceras och styrtangenter ignoreras'
  );
} else {
  check(false, 'sent iOS-beforeinput dedupliceras och styrtangenter ignoreras');
}

console.log('\nVävbordets noder och spänningslins');

check(html.includes('context.setLineDash([9, 6])'), 'lexikala kopplingar är streckade');
check(html.includes('context.setLineDash([1.5, 5])'), 'rubrikhierarkin är prickad');
check(html.includes('legend-line cohesion'), 'teckenförklaringen visar lexikal linje');
check(html.includes('legend-line hierarchy'), 'teckenförklaringen visar hierarkisk linje');
check(html.includes('function setGraphLens'), 'Vävlinsen kan isolera grafens lager');
check(html.includes('function graphEdgeVisible'), 'Vävlinsen filtrerar ritade kopplingar');
check(html.includes('function updateGraphLensStatus'), 'tomma Vävlinsresultat förklaras');
check(html.includes('state.element.tabIndex = interactive && included && id === tabStopId ? 0 : -1'), 'Vävlinsen använder ett filtrerat roving-tabbstopp');
check(html.includes('if (hoveredId === node.id) hoveredId = null'), 'gammalt nodfokus släpps när Vävlinsen används');
check(html.includes("graphLens === 'tension'"), 'Spänningslinsen har ett eget begränsat nodlager');
check(html.includes('Spänning mot en annan plats'), 'spänning beskrivs som relation, inte kvalitetsbetyg');
check(html.includes('node-edit-text'), 'vald nod kan rullas ut till direkt textredigering');
check(html.includes("document.startViewTransition(update)"), 'vybytet använder objektbevarande övergång när webbläsaren stöder den');
check(html.includes('orderY - node.y'), 'nodfältet förankras mjukt i dokumentets läsordning');
check(html.includes('data-writing-index'), 'synliga Skrivsömmar bär exakta infogningsindex');
check(html.includes('function guardActiveEdit'), 'en central redigeringsspärr skyddar osparad direktredigering');
check(html.includes('editingBuffer'), 'pågående direktredigering har en bevarad arbetsbuffert');
check(html.includes('document.blocks.findIndex(block => block.id === document.lastCommittedBlockId)'), 'återtagning hittar exakt senast invävda block');
check(html.includes('document.blocks.splice(insertion, 0, block)'), 'återtaget block återinfogas på sin ursprungliga plats');
check(html.includes('lastCommittedBlockUnavailable'), 'raderat senast invävt block kan inte ersättas av fel återtagning');
check(html.includes('if (changeActiveDocument(id) === false) return'), 'blockerat dokumentbyte lämnar fokus i redigeringsfältet');
check(!html.includes('data-graph-lens="tension"'), 'Spänning visas bara som global lins, inte som ett tredje trådläge');
check(html.includes('if (node.flow) ids.add(node.id)'), 'Spänningslinsen skiljer dragkamp från ensamma lexikala glapp');
check(html.includes('lastWritingSeamIndex'), 'Skrivsömmarna använder ett enda roving-tabbstopp');
check(html.includes("button.setAttribute('aria-controls', 'inspector')"), 'noder annonserar sin koppling till Kantnoten');
check(html.includes('function graphOrderBounds'), 'nodfältet komprimeras för låga liggande skärmar');
check(html.includes("window.addEventListener('beforeunload'"), 'webbläsaren varnar om direktredigering lämnas osparad');
check(html.includes('const WIDTHS = [540, 640, 720, 820, 940, 1080, 1240, 1440]'), 'skrivfältet kan bli 1 440 pixlar brett');
check(html.includes('elements.composer.getBoundingClientRect().width'), 'bredddragning utgår från synlig bredd');
check(html.includes('const renderedWidths = WIDTHS.map(width => Math.min(width, widthLimit))'), 'bredddragning jämför viewportklampade kandidater');
check(html.includes('applyWidth(settings.widthIndex)'), 'återställd bredd appliceras direkt');
check(
  (html.match(/settings\.widthIndex = normalizeWidthIndex\(settings\.widthIndex\)/g) || []).length >= 1 &&
  html.includes('stored.settings.widthIndex = normalizeWidthIndex(stored.settings.widthIndex)'),
  'breddindex normaliseras vid laddning och återställning'
);
check(html.includes('elements.widthSlider.max = String(WIDTHS.length - 1)'), 'breddreglagets max följer breddtabellen');
check(html.includes("formatNumber(width) + ' pixlar'"), 'breddreglaget får exakt ARIA-värde');
check(html.includes('width: min(var(--composer-width), calc(100% - 48px))'), 'desktopbredden lämnar plats för handtagen');
check(
  html.includes('@media (max-width: 900px), (hover: none), (pointer: coarse)') &&
  html.includes('#width-slider {\n        min-height: 44px;'),
  'grova pekdon får responsiv bredd och 44 pixlars slider'
);

console.log('\nDokumentytan');

for (const id of [
  'documents-button',
  'active-document-label',
  'document-hub',
  'document-create-form',
  'document-list',
  'document-graph-view',
  'document-graph-stage',
  'document-graph-svg',
  'document-graph-nodes'
]) {
  check(html.includes(`id="${id}"`), '#' + id + ' finns');
}

check(html.includes('function openDocumentHub'), 'dokumentytan kan öppnas direkt från toppbaren');
check(html.includes('function createDocumentFromHub'), 'nytt dokument skapas och öppnas i ett sammanhållet flöde');
check(html.includes('function openDocumentFromHub'), 'listkort och dokumentnoder öppnar valt dokument');
check(html.includes("documentHubView: 'list'"), 'listan är dokumentytans lugna standardvy');
check(html.includes("stored.settings.documentHubView === 'graph' ? 'graph' : 'list'"), 'vald dokumentvy normaliseras vid laddning');
check(html.includes("settings.documentHubView === 'graph' ? 'graph' : 'list'"), 'vald dokumentvy normaliseras vid återställning');
check(html.includes("documentContentText(document), new Set(document.hiddenWords || [])"), 'dokumentjämförelsen respekterar dolda ord');
check(html.includes("documentContentText(document)") && html.includes('Utkast räknas inte'), 'likhetsanalysen använder invävd text och förklarar att utkast inte räknas');
check(html.includes('data-document-id="${escapeHtml(node.id)}"'), 'varje dokumentnod bär ett entydigt dokument-id');
check(html.includes("node.addEventListener('click', () => openDocumentFromHub(id))"), 'klick på en dokumentnod öppnar dokumentet');
check(html.includes("active ? 'Aktivt dokument' : 'Dokument'"), 'dokumentnoder märks tydligt och aktiv nod skiljs ut');

const functionSource = name => inlineScript?.match(
  new RegExp(`function ${name}\\([^\\n]*\\) \\{[\\s\\S]*?^    \\}`, 'm')
)?.[0];
const documentFunctionNames = [
  'documentContentText',
  'documentSimilarityThreshold',
  'selectDocumentEdges',
  'analyzeDocuments',
  'stableUnit',
  'layoutDocumentGraph'
];
const documentFunctionSources = documentFunctionNames.map(functionSource);

if (documentFunctionSources.every(Boolean)) {
  const documentSandbox = {};
  vm.runInNewContext(`
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const pairKey = (a, b) => a < b ? a + '|' + b : b + '|' + a;
    const wordCount = text => (String(text || '').match(/[a-zåäöéüæø]+/gi) || []).length;
    function tokenize(text, hiddenWords = new Set()) {
      const map = new Map();
      for (const surface of String(text || '').toLowerCase().match(/[a-zåäöéüæø]+/g) || []) {
        if (hiddenWords.has(surface)) continue;
        let item = map.get(surface);
        if (!item) {
          item = { tf: 0, forms: new Map() };
          map.set(surface, item);
        }
        item.tf += 1;
        item.forms.set(surface, (item.forms.get(surface) || 0) + 1);
      }
      return map;
    }
    function buildIdf(maps) {
      const df = new Map();
      maps.forEach(map => map.forEach((_, key) => df.set(key, (df.get(key) || 0) + 1)));
      return new Map([...df].map(([key, count]) => [key, Math.log(1 + maps.length / count)]));
    }
    function buildVector(map, idf) {
      const values = new Map();
      let squared = 0;
      map.forEach((item, key) => {
        const weight = (1 + Math.log(item.tf)) * (idf.get(key) || 1);
        values.set(key, weight);
        squared += weight * weight;
      });
      return { values, norm: Math.sqrt(squared) };
    }
    function cosine(a, b) {
      if (!a.norm || !b.norm) return 0;
      let dot = 0;
      a.values.forEach((weight, key) => { if (b.values.has(key)) dot += weight * b.values.get(key); });
      return dot / (a.norm * b.norm);
    }
    function commonWords(a, b, idf, limit = 5) {
      return [...a.keys()]
        .filter(key => b.has(key))
        .sort((x, y) => (idf.get(y) || 0) - (idf.get(x) || 0))
        .slice(0, limit);
    }
    let app = {
      activeId: 'a',
      settings: { threshold: .12 },
      documents: [
        { id: 'a', title: 'Livets uppkomst', blocks: [{ text: 'kemisk evolution molekyler vatten energi ursprung liv reaktioner katalys' }], draft: '', hiddenWords: [] },
        { id: 'b', title: 'RNA-världen', blocks: [{ text: 'kemisk evolution molekyler vatten energi tidigt liv reaktioner RNA' }], draft: '', hiddenWords: [] },
        { id: 'c', title: 'Skrivande', blocks: [{ text: 'skrivverktyg struktur fokus redigering rubriker nätverk författare text' }], draft: '', hiddenWords: [] },
        { id: 'd', title: 'Tomt utkast', blocks: [], draft: 'kemisk evolution molekyler vatten energi tidigt liv reaktioner RNA', hiddenWords: [] }
      ]
    };
    ${documentFunctionSources.join('\n')}
    globalThis.documentAnalysis = analyzeDocuments(app.documents);
    globalThis.documentLayout = layoutDocumentGraph(
      globalThis.documentAnalysis.nodes,
      globalThis.documentAnalysis.edges,
      900,
      500
    );
    globalThis.mobileDocumentLayout = layoutDocumentGraph(
      globalThis.documentAnalysis.nodes,
      globalThis.documentAnalysis.edges,
      390,
      620
    );
    app.settings.threshold = .01;
    globalThis.minimumThreshold = documentSimilarityThreshold();
  `, documentSandbox);

  const result = documentSandbox.documentAnalysis;
  const positions = [...documentSandbox.documentLayout.values()];
  const mobilePositions = [...documentSandbox.mobileDocumentLayout.values()];
  check(result.nodes.length === 4, 'dokumentanalysen skapar en nod per dokument');
  check(
    result.fullEdges.some(edge => [edge.a, edge.b].sort().join('|') === 'a|b') &&
    result.fullEdges.every(edge => !edge.a.includes('c') && !edge.b.includes('c')),
    'lexikalt närliggande dokument kopplas utan falsk koppling till det främmande dokumentet'
  );
  check(result.nodes.find(node => node.id === 'd')?.insufficient === true, 'tomt dokument med endast utkast märks som otillräckligt');
  check(documentSandbox.minimumThreshold === .08, 'dokumentjämförelsen har en försiktig minimitröskel');
  check(
    positions.length === 4 &&
    positions.every(position => position.x >= 99 && position.x <= 801 && position.y >= 61 && position.y <= 439),
    'dokumentnoderna läggs inom grafytans synliga gränser'
  );
  check(
    mobilePositions.length === 4 &&
    mobilePositions.every(position => position.x >= 77 && position.x <= 313 && position.y >= 56 && position.y <= 564),
    'dokumentnoderna klampas inom en smal mobil grafyta'
  );
} else {
  check(false, 'dokumentanalysens och nodlayoutens funktioner kunde testas');
}

console.log('\nSammanfattning');
console.log(`  ${passed} godkända, ${failed} fel av ${passed + failed} kontroller\n`);
if (failed) process.exit(1);
