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
  'structure-breadcrumb',
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

console.log('\nSammanfattning');
console.log(`  ${passed} godkända, ${failed} fel av ${passed + failed} kontroller\n`);
if (failed) process.exit(1);
