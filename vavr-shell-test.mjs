import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync('index.html', 'utf8');
const manifest = JSON.parse(readFileSync('manifest.webmanifest', 'utf8'));
const worker = readFileSync('sw.js', 'utf8');
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
check(!/<script[^>]+src=/.test(html), 'inga externa skript används');
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

console.log('\nSkrivstöd och Sektionstavla');

for (const id of [
  'goal-enabled',
  'goal-progress',
  'timer-display',
  'timer-primary',
  'writing-support-summary',
  'graph-lens',
  'graph-lens-status',
  'structure-breadcrumb',
  'structure-pulse',
  'structure-board',
  'section-grid',
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

console.log('\nVävens linjer');

check(html.includes('context.setLineDash([9, 6])'), 'lexikala kopplingar är streckade');
check(html.includes('context.setLineDash([1.5, 5])'), 'rubrikhierarkin är prickad');
check(html.includes('legend-line cohesion'), 'teckenförklaringen visar lexikal linje');
check(html.includes('legend-line hierarchy'), 'teckenförklaringen visar hierarkisk linje');
check(html.includes('function setGraphLens'), 'Vävlinsen kan isolera grafens lager');
check(html.includes('function graphEdgeVisible'), 'Vävlinsen filtrerar ritade kopplingar');
check(html.includes('pulse-segment'), 'Dokumentpulsen visar sektionernas omfång och signaler');
check(html.includes('function updateGraphLensStatus'), 'tomma Vävlinsresultat förklaras');
check(html.includes('state.element.tabIndex = interactive && included ? 0 : -1'), 'Vävlinsen filtrerar tangentbordsfokus');
check(html.includes('if (hoveredId === node.id) hoveredId = null'), 'gammalt nodfokus släpps när Vävlinsen används');
check(html.includes('const { issueRatio, assessment, shortAssessment } = pulseAssessment(item)'), 'Dokumentpulsen skiljer signaler från analysunderlag');

const pulseAssessmentSource = inlineScript?.match(
  /function pulseAssessment\(item\) \{[\s\S]*?^    \}/m
)?.[0];
if (pulseAssessmentSource) {
  const pulseSandbox = {};
  vm.runInNewContext(`
    ${pulseAssessmentSource}
    globalThis.pulseResults = [
      pulseAssessment({ paragraphs: 0, assessed: 0, unassessed: 0, issues: 0 }),
      pulseAssessment({ paragraphs: 2, assessed: 0, unassessed: 2, issues: 0 }),
      pulseAssessment({ paragraphs: 4, assessed: 2, unassessed: 2, issues: 1 })
    ];
  `, pulseSandbox);
  check(
    pulseSandbox.pulseResults[0].assessment === 'Tom sektion' &&
    pulseSandbox.pulseResults[1].assessment === 'För litet analysunderlag' &&
    pulseSandbox.pulseResults[2].issueRatio === .5,
    'Dokumentpulsen märker tomt, otillräckligt och bedömt underlag korrekt'
  );
} else {
  check(false, 'Dokumentpulsen märker tomt, otillräckligt och bedömt underlag korrekt');
}
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

console.log('\nSammanfattning');
console.log(`  ${passed} godkända, ${failed} fel av ${passed + failed} kontroller\n`);
if (failed) process.exit(1);
