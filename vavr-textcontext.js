/* VävR: TextContext.
   Porterad från SkrivR:s text-context.js. Kontraktet mot ljudmotorerna är
   oförändrat: window.TextContext.getStats() returnerar samma fält med samma
   betydelser. Tre skillnader:

   1. Källan är en funktion, inte en textarea. SkrivR band sig till
      textarea.value, men i VävR innehåller skrivraden bara det block som
      skrivs just nu. Motorerna behöver hela dokumentet för att g-faktorn
      och sektionsstatistiken ska betyda något, därför setKalla(fn).

   2. Fältet words finns nu. Det saknades i SkrivR, vilket gav NaN i
      HardFork och Space Odyssey. Se ARBETSORDER, avsnittet om buggen.

   3. Två takter. Den lätta uppdaterar teckenstatistik löpande, den tunga
      gör full omskanning vid blockcommit och vid paus. */

const ALFABET = 'abcdefghijklmnopqrstuvwxyzåäö';
const VOKALER = new Set('aeiouyåäö'.split(''));
const FRIKATIVOR = new Set('sfvzchj'.split(''));

const statsObj = {
  N: 0, sumAlpha: 0, vowelCount: 0, fricCount: 0,
  wordCount: 0, words: 0, longWordCount: 0, sumWordLen: 0,
  sentCount: 0, sumSentLen: 0, paragraphs: 0, headings: 0,
  harmonicShiftCount: 0, lastHeadingLevel: 0, lix: 0,
  meanAlpha: 14, vowelRatio: 0.38, fricRatio: 0.10,
  meanWordLen: 5, meanSentLen: 60, g: 1.0,
  section_N: 0, section_sumAlpha: 0, section_vowelCount: 0, section_fricCount: 0,
  section_meanAlpha: 14, section_vowelRatio: 0.38
};

let kalla = null;
let smutsig = true;
let senasteSkanning = 0;
let pausTimer = null;
let takTimer = null;

export const MIN_OMSKANNING_MS = 400;
export const PAUS_MS = 800;
export const TAK_MS = 6000;

function nollstall() {
  statsObj.N = 0; statsObj.sumAlpha = 0; statsObj.vowelCount = 0; statsObj.fricCount = 0;
  statsObj.wordCount = 0; statsObj.words = 0; statsObj.longWordCount = 0; statsObj.sumWordLen = 0;
  statsObj.sentCount = 0; statsObj.sumSentLen = 0; statsObj.paragraphs = 0; statsObj.headings = 0;
  statsObj.harmonicShiftCount = 0; statsObj.lastHeadingLevel = 0;
  statsObj.section_N = 0; statsObj.section_sumAlpha = 0;
  statsObj.section_vowelCount = 0; statsObj.section_fricCount = 0;
}

function harledda() {
  statsObj.meanAlpha = statsObj.N > 0 ? statsObj.sumAlpha / statsObj.N : 14;
  statsObj.vowelRatio = statsObj.N > 0 ? statsObj.vowelCount / statsObj.N : 0.38;
  statsObj.fricRatio = statsObj.N > 0 ? statsObj.fricCount / statsObj.N : 0.10;
  statsObj.meanWordLen = statsObj.wordCount > 0 ? statsObj.sumWordLen / statsObj.wordCount : 5;
  statsObj.meanSentLen = statsObj.sentCount > 0 ? statsObj.sumSentLen / statsObj.sentCount : 60;
  statsObj.words = statsObj.wordCount;
  statsObj.g = 40 / (40 + statsObj.N);

  statsObj.section_meanAlpha = statsObj.section_N > 0
    ? statsObj.section_sumAlpha / statsObj.section_N : statsObj.meanAlpha;
  statsObj.section_vowelRatio = statsObj.section_N > 0
    ? statsObj.section_vowelCount / statsObj.section_N : statsObj.vowelRatio;

  if (statsObj.wordCount > 0 && statsObj.sentCount > 0) {
    const ordPerMening = statsObj.wordCount / statsObj.sentCount;
    const langaAndel = (statsObj.longWordCount * 100) / statsObj.wordCount;
    statsObj.lix = Math.round(ordPerMening + langaAndel);
  } else {
    statsObj.lix = 0;
  }
}

export function fullSkanning() {
  if (typeof kalla !== 'function') return statsObj;
  const text = String(kalla() || '');
  const gemener = text.toLowerCase();
  nollstall();

  let ordLangd = 0;
  let meningLangd = 0;

  for (let i = 0; i < text.length; i++) {
    const tecken = gemener[i];

    /* Rubrikdetektion. SkrivR hade ett felskrivet villkor här som råkade
       fungera genom operatorprecedens. Här är det parentessatt korrekt. */
    if (text[i] === '#' && (i === 0 || text[i - 1] === '\n')) {
      let j = i;
      while (j < text.length && text[j] === '#') j++;
      const nivaOk = j - i >= 1 && j - i <= 6;
      const avslutOk = j >= text.length || text[j] === ' ' || text[j] === '\n';
      if (nivaOk && avslutOk) {
        const niva = j - i;
        statsObj.headings++;
        statsObj.lastHeadingLevel = niva;
        if (niva === 1) statsObj.harmonicShiftCount += 2;
        else if (niva === 2) statsObj.harmonicShiftCount += 1;
        statsObj.section_N = 0;
        statsObj.section_sumAlpha = 0;
        statsObj.section_vowelCount = 0;
        statsObj.section_fricCount = 0;
      }
    }

    meningLangd++;
    const idx = ALFABET.indexOf(tecken);

    if (idx !== -1) {
      statsObj.N++; statsObj.section_N++;
      statsObj.sumAlpha += idx; statsObj.section_sumAlpha += idx;
      if (VOKALER.has(tecken)) { statsObj.vowelCount++; statsObj.section_vowelCount++; }
      if (FRIKATIVOR.has(tecken)) { statsObj.fricCount++; statsObj.section_fricCount++; }
      ordLangd++;
    } else if (ordLangd > 0) {
      statsObj.wordCount++;
      statsObj.sumWordLen += ordLangd;
      if (ordLangd > 6) statsObj.longWordCount++;
      ordLangd = 0;
    }

    if (tecken === '.' || tecken === '!' || tecken === '?') {
      statsObj.sentCount++;
      statsObj.sumSentLen += meningLangd;
      meningLangd = 0;
    }
  }

  if (ordLangd > 0) {
    statsObj.wordCount++;
    statsObj.sumWordLen += ordLangd;
    if (ordLangd > 6) statsObj.longWordCount++;
  }
  if (meningLangd > 0 && statsObj.N > 0) {
    statsObj.sentCount++;
    statsObj.sumSentLen += meningLangd;
  }

  const rader = text.match(/[^\r\n]+/g);
  statsObj.paragraphs = rader ? rader.length : 0;

  harledda();
  smutsig = false;
  senasteSkanning = nu();
  return statsObj;
}

function nu() {
  return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
}

/* Lätt takt. Anropas per tecken från skrivraden. Uppdaterar de billiga
   räknarna direkt så att ljudmotorerna svarar utan fördröjning, och
   markerar sedan för full omskanning. */
export function taTecken(tecken) {
  if (typeof tecken === 'string' && tecken.length === 1) {
    const idx = ALFABET.indexOf(tecken.toLowerCase());
    if (idx !== -1) {
      statsObj.N++;
      statsObj.sumAlpha += idx;
      if (VOKALER.has(tecken.toLowerCase())) statsObj.vowelCount++;
      if (FRIKATIVOR.has(tecken.toLowerCase())) statsObj.fricCount++;
      harledda();
    }
  }
  smutsig = true;
  schemalagg();
}

function schemalagg() {
  if (!smutsig) return;
  if (pausTimer) clearTimeout(pausTimer);
  pausTimer = setTimeout(() => { if (smutsig) fullSkanning(); }, PAUS_MS);
  if (!takTimer) {
    takTimer = setTimeout(() => { if (smutsig) fullSkanning(); takTimer = null; }, TAK_MS);
  }
}

export const TextContext = {
  setKalla(fn) { kalla = fn; fullSkanning(); },
  taTecken,
  markeraSmutsig() { smutsig = true; schemalagg(); },
  getStats() {
    if (smutsig && (nu() - senasteSkanning > MIN_OMSKANNING_MS)) fullSkanning();
    return statsObj;
  },
  forceRescan: fullSkanning,
  frigor() {
    if (pausTimer) clearTimeout(pausTimer);
    if (takTimer) clearTimeout(takTimer);
    pausTimer = null; takTimer = null; kalla = null;
  }
};

if (typeof window !== 'undefined') window.TextContext = TextContext;
