import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync('index.html', 'utf8');
const valsangSource = readFileSync('valsang-engine.js', 'utf8');
const hardForkSource = readFileSync('hardfork-engine.js', 'utf8');
const nebulapulsSource = readFileSync('nebulapuls-engine.js', 'utf8');
const inlineScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] || '';
const soundStart = inlineScript.indexOf('const SOUND_THEMES =');
const soundEnd = inlineScript.indexOf('    const elements =', soundStart);

if (soundStart < 0 || soundEnd < 0) {
  throw new Error('Kunde inte hitta VävR:s ljudmotor i index.html.');
}

const soundSource = inlineScript.slice(soundStart, soundEnd) +
  '\nglobalThis.testSoundscape = Soundscape; globalThis.testThemes = SOUND_THEMES;' +
  '\nglobalThis.testTypewriter = Typewriter; globalThis.testTypewriterThemes = TYPEWRITER_THEMES;';

class FakeParam {
  constructor(value = 0) {
    this.value = value;
  }

  setValueAtTime(value) { this.value = value; }
  linearRampToValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
  setTargetAtTime(value) { this.value = value; }
  cancelScheduledValues() {}
}

class FakeNode {
  constructor(kind = 'node') {
    this.kind = kind;
    this.gain = new FakeParam();
    this.frequency = new FakeParam();
    this.detune = new FakeParam();
    this.delayTime = new FakeParam();
    this.Q = new FakeParam();
    this.playbackRate = new FakeParam(1);
    this.pan = new FakeParam();
    this.threshold = new FakeParam();
    this.knee = new FakeParam();
    this.ratio = new FakeParam();
    this.attack = new FakeParam();
    this.release = new FakeParam();
    this.listeners = {};
  }

  connect(target) { return target; }
  disconnect() {}
  addEventListener(name, callback) { this.listeners[name] = callback; }
  start(time) { FakeAudioContext.startTimes.push(time); }
  stop(time) {
    if (this.kind === 'oscillator') {
      FakeAudioContext.oscillatorStopCalls += 1;
      FakeAudioContext.oscillatorStopTimes.push(time);
    }
    this.listeners.ended?.();
  }
}

class FakeAudioContext {
  static deferResume = false;
  static pendingResumes = [];
  static bufferCreations = 0;
  static waveShaperCreations = 0;
  static oscillatorCreations = 0;
  static oscillatorStopCalls = 0;
  static oscillatorStopTimes = [];
  static convolverCreations = 0;
  static delayCreations = 0;
  static startTimes = [];
  static instances = [];

  constructor() {
    this.sampleRate = 8000;
    this.currentTime = 0;
    this.state = 'running';
    this.destination = new FakeNode();
    this.resumeCalls = 0;
    FakeAudioContext.instances.push(this);
  }

  createBuffer(channels, length) {
    FakeAudioContext.bufferCreations += 1;
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { getChannelData: index => data[index] };
  }

  createBufferSource() { return new FakeNode('buffer-source'); }
  createBiquadFilter() { return new FakeNode(); }
  createConvolver() {
    FakeAudioContext.convolverCreations += 1;
    return new FakeNode();
  }
  createDelay() {
    FakeAudioContext.delayCreations += 1;
    return new FakeNode();
  }
  createGain() { return new FakeNode(); }
  createOscillator() {
    FakeAudioContext.oscillatorCreations += 1;
    return new FakeNode('oscillator');
  }
  createStereoPanner() { return new FakeNode(); }
  createDynamicsCompressor() { return new FakeNode(); }
  createWaveShaper() {
    FakeAudioContext.waveShaperCreations += 1;
    return new FakeNode();
  }
  resume() {
    this.resumeCalls += 1;
    if (!FakeAudioContext.deferResume) {
      this.state = 'running';
      return Promise.resolve();
    }
    return new Promise(resolve => FakeAudioContext.pendingResumes.push(() => {
      this.state = 'running';
      resolve();
    }));
  }
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }

  static releaseResumes() {
    const pending = FakeAudioContext.pendingResumes.splice(0);
    pending.forEach(release => release());
  }
}

const sandbox = {
  window: { AudioContext: FakeAudioContext },
  document: {
    hidden: false,
    addEventListener() {},
    removeEventListener() {}
  },
  Math,
  Date,
  performance: { now: () => Date.now() },
  Promise,
  Set,
  Float32Array,
  setInterval,
  clearInterval,
  setTimeout,
  clearTimeout,
  clamp: (value, min, max) => Math.max(min, Math.min(max, value))
};

vm.createContext(sandbox);
vm.runInContext(valsangSource, sandbox);
vm.runInContext(hardForkSource, sandbox);
vm.runInContext(nebulapulsSource, sandbox);
vm.runInContext(soundSource, sandbox);

const engine = sandbox.testSoundscape;
const themes = [
  'glantan',
  'regnvav',
  'djupstrom',
  'nattljus',
  'ordfalt',
  'sambandsvav',
  'strukturklang',
  'valsang',
  'hardfork',
  'nebulapuls'
];
let passed = 0;

for (const theme of themes) {
  if (!sandbox.testThemes[theme]) throw new Error('Temat saknas: ' + theme);
  if (!await engine.start(theme, 24, {
    words: 640,
    averageWordLength: 5.8,
    vowelRatio: .42,
    averageSentenceWords: 14,
    paragraphs: 9,
    headings: 3,
    headingDepth: 2,
    cohesion: .38,
    connectedness: .72
  })) throw new Error('Start misslyckades: ' + theme);
  if (!engine.isPlaying() || !engine.isReady() || engine.theme() !== theme) {
    throw new Error('Fel aktivt tema: ' + theme);
  }

  engine.handleKey('a');
  engine.handleKey('.');
  engine.updateText({
    words: 820,
    averageWordLength: 6.2,
    vowelRatio: .39,
    averageSentenceWords: 17,
    paragraphs: 12,
    headings: 4,
    headingDepth: 1,
    cohesion: .52,
    connectedness: .81
  });
  engine.commit('paragraph');
  engine.commit('heading');
  engine.setVolume(12);
  engine.stop(true);

  if (engine.isPlaying()) throw new Error('Stopp misslyckades: ' + theme);
  passed += 1;
  console.log('  ok   ' + theme + ' startar, reagerar och stängs');
}

const valsangConvolversBefore = FakeAudioContext.convolverCreations;
const valsangOscillatorsBefore = FakeAudioContext.oscillatorCreations;
await engine.start('valsang', 24, {
  words: 280,
  characters: 1640,
  averageWordLength: 5.4,
  vowelRatio: .43,
  paragraphs: 6,
  documentTitle: 'Valarnas väg'
});
const valsangEngine = sandbox.window.ValsangEngine;
const initialValsangState = valsangEngine.getState();
if (
  FakeAudioContext.convolverCreations <= valsangConvolversBefore ||
  FakeAudioContext.oscillatorCreations < valsangOscillatorsBefore + 12 ||
  initialValsangState.voicePoolSize !== 3 ||
  initialValsangState.voiceGeneration !== 0
) {
  throw new Error('Valsång byggde inte sin fasta tre-rösterspool, LFO:er och reverbrum.');
}
engine.commit('paragraph', { text: '   ' });
if (
  valsangEngine.getState().voiceGeneration !== 0 ||
  valsangEngine.getState().responseSongCount !== 0
) {
  throw new Error('Valsång svarade musikaliskt på ett tomt block.');
}
engine.handleKey('a');
engine.handleKey('s');
engine.handleKey('k');
engine.handleKey('.');
const generationBeforeEnter = valsangEngine.getState().voiceGeneration;
engine.handleKey('Enter');
if (valsangEngine.getState().voiceGeneration !== generationBeforeEnter) {
  throw new Error('Enter roterade Valsångens röst trots att inget block hade vävts in.');
}
const oscillatorsBeforeCommits = FakeAudioContext.oscillatorCreations;
const oscillatorStopsBeforeCommits = FakeAudioContext.oscillatorStopCalls;
engine.commit('paragraph', {
  text: 'Havet bär den första långa frasen vidare.',
  vowelRatio: .44,
  averageSentenceWords: 8,
  similarityToPrevious: .72
});
let valsangState = valsangEngine.getState();
if (
  valsangState.voiceGeneration !== generationBeforeEnter + 1 ||
  valsangState.foregroundVoice !== 1 ||
  valsangState.lastCommitKind !== 'paragraph' ||
  valsangState.responseSongCount !== 1 ||
  valsangState.lastResponseSong?.role !== 'answer-song' ||
  valsangState.lastResponseSong?.relationship !== 'echo' ||
  valsangState.lastResponseSong?.source !== 'typed-contour' ||
  valsangState.lastResponseSong?.degrees.length < 3 ||
  valsangState.lastResponseSong?.durationSeconds > 6 ||
  valsangState.lastFadeSeconds < 8 ||
  valsangState.lastFadeSeconds > 14
) {
  throw new Error('Ett invävt stycke gav inte både en långsamt övertonad röst och en kort kontextstyrd svarssång.');
}
engine.commit('heading', {
  text: 'Djupare vatten',
  level: 2,
  vowelRatio: .48,
  averageSentenceWords: 4,
  similarityToPrevious: .28
});
valsangState = valsangEngine.getState();
if (
  valsangState.lastCommitKind !== 'heading' ||
  valsangState.foregroundVoice !== 2 ||
  valsangState.lastResponseSong?.role !== 'theme-call' ||
  valsangState.lastResponseSong?.relationship !== 'section-call'
) {
  throw new Error('En rubrik skapade inte en tydlig temaväxling i Valsången.');
}
engine.commit('paragraph', {
  text: 'Eko?',
  words: 1,
  vowelRatio: .5,
  averageSentenceWords: 1,
  similarityToPrevious: .18
});
const microResponse = valsangEngine.getState().lastResponseSong;
if (
  microResponse?.role !== 'micro-answer' ||
  microResponse?.cadence !== 'question' ||
  microResponse?.degrees.length !== 2 ||
  microResponse?.durationSeconds >= 3
) {
  throw new Error('Valsång gav inte ett kort, diskret mikrosvar på ett mycket kort block.');
}
engine.commit('paragraph', {
  text: Array.from({ length: 150 }, (_, index) => 'havston' + index).join(' ') + '.',
  words: 150,
  vowelRatio: .43,
  averageSentenceWords: 30,
  similarityToPrevious: .64
});
const longResponse = valsangEngine.getState().lastResponseSong;
if (
  longResponse?.role !== 'answer-song' ||
  longResponse?.cadence !== 'resolution' ||
  longResponse?.degrees.length <= microResponse.degrees.length ||
  longResponse?.degrees.length > 7 ||
  longResponse?.durationSeconds > 6.2
) {
  throw new Error('Valsång lät inte textlängd och sluttecken forma en begränsad svarssång.');
}
const whaleCallTypes = new Set();
const whaleCallFamilies = new Set();
for (let index = 0; index < 32; index++) {
  engine.commit('paragraph', {
    text: `Havets röst nummer ${index} rör sig genom vattnet i en egen harmonisk fras.`,
    words: 13,
    vowelRatio: .38 + (index % 7) * .025,
    averageSentenceWords: 8 + index % 13,
    similarityToPrevious: (index % 9) / 8
  });
  const call = valsangEngine.getState().lastResponseSong;
  whaleCallTypes.add(call?.callType);
  whaleCallFamilies.add(call?.callFamily);
  const timbreSum = (call?.timbre?.fundamental || 0) +
    (call?.timbre?.overtone || 0) +
    (call?.timbre?.sub || 0);
  if (
    !call?.callType ||
    !call?.callFamily ||
    call.degrees.some(degree => !Number.isInteger(degree) || degree < 0 || degree > 15) ||
    call.durationSeconds > 6.2 ||
    Math.abs(timbreSum - 1) > .0001
  ) {
    throw new Error('Valsångens lätesregister lämnade det harmoniska eller nivåmässiga säkerhetsområdet.');
  }
}
if (
  whaleCallTypes.size !== 4 ||
  whaleCallFamilies.size !== 4 ||
  !whaleCallTypes.has('deep-moan') ||
  !whaleCallTypes.has('upcall') ||
  !whaleCallTypes.has('warble') ||
  !whaleCallTypes.has('pulse-train')
) {
  throw new Error('Valsång använde inte hela registret av moans, kontaktläten, warbles och pulssviter.');
}
for (let index = 0; index < 120; index++) {
  engine.commit('paragraph', {
    text: 'Stycke ' + index + ' återkommer med en gradvis förändrad kontur.',
    vowelRatio: .39 + (index % 5) * .015,
    averageSentenceWords: 9 + index % 11,
    similarityToPrevious: (index % 10) / 10
  });
}
valsangState = valsangEngine.getState();
if (
  valsangState.voicePoolSize !== 3 ||
  valsangState.activeVoices > 3 ||
  !valsangState.responseUsesVoicePool ||
  FakeAudioContext.oscillatorCreations !== oscillatorsBeforeCommits ||
  FakeAudioContext.oscillatorStopCalls !== oscillatorStopsBeforeCommits ||
  valsangState.lastResponseSong?.source !== 'block-text'
) {
  throw new Error('Valsångens svarssånger stannade inte inom den fasta tre-rösterspoolen.');
}
engine.stop(true);
if (
  valsangEngine.getState().voicePoolSize !== 0 ||
  valsangEngine.getState().responseSongCount !== 0 ||
  valsangEngine.getState().lastResponseSong !== null
) {
  throw new Error('Valsångens röstpool eller svarsmusik tömdes inte vid stopp.');
}
console.log('  ok   Valsång skiljer frasslut från blockcommit och formar varje svarssång inom sin fasta tre-rösterspool');

const deterministicValsangProfile = {
  words: 44,
  characters: 280,
  vowelRatio: .42,
  paragraphs: 2,
  documentTitle: 'Samma hav'
};
const deterministicValsangBlock = {
  text: 'Samma stycke återvänder och ber havet att svara?',
  words: 9,
  vowelRatio: .44,
  averageSentenceWords: 9,
  similarityToPrevious: .63
};
await engine.start('valsang', 24, deterministicValsangProfile);
engine.commit('paragraph', deterministicValsangBlock);
const firstResponsePlan = valsangEngine.getState().lastResponseSong;
engine.stop(true);
await engine.start('valsang', 24, deterministicValsangProfile);
engine.commit('paragraph', deterministicValsangBlock);
const repeatedResponsePlan = valsangEngine.getState().lastResponseSong;
if (
  repeatedResponsePlan.signature !== firstResponsePlan.signature ||
  JSON.stringify(repeatedResponsePlan.degrees) !== JSON.stringify(firstResponsePlan.degrees) ||
  JSON.stringify(repeatedResponsePlan.offsets) !== JSON.stringify(firstResponsePlan.offsets) ||
  repeatedResponsePlan.cadence !== firstResponsePlan.cadence
) {
  throw new Error('Valsång gav inte samma block samma svar från samma musikaliska utgångsläge.');
}
engine.stop(true);
console.log('  ok   Valsångens blockmappning är deterministisk från samma utgångsläge');

await engine.start('valsang', 24, deterministicValsangProfile);
const valsangAccentContext = FakeAudioContext.instances.at(-1);
valsangAccentContext.currentTime = 6;
engine.handleKey('(');
engine.handleKey(')');
engine.handleKey('a');
engine.handleKey('.');
engine.handleKey('Enter');
engine.commit('paragraph', {
  text: 'En samlad fras når den första fjärdedelen.',
  words: 8,
  vowelRatio: .44,
  averageSentenceWords: 8,
  similarityToPrevious: .58,
  goalMilestone: 25
});
const valsangAccentState = valsangEngine.getState();
const valsangAccentPlan = valsangAccentState.lastResponseSong;
if (
  valsangAccentState.pairedAccentCount !== 2 ||
  valsangAccentState.composedAccentCount < 1 ||
  valsangAccentState.pendingEnterAccent ||
  valsangAccentState.pendingSentenceAccent ||
  valsangAccentPlan?.goalMilestone !== 25 ||
  !valsangAccentPlan?.accentComposition?.includes('sentence-.') ||
  !valsangAccentPlan?.accentComposition?.includes('commit') ||
  !valsangAccentPlan?.accentComposition?.includes('goal-25')
) {
  throw new Error('Valsångsdirigenten samlade inte parl ljud, meningsslut, commit och målmilstolpe.');
}
for (let index = 0; index < 8; index++) engine.handleKey(index % 2 ? ')' : '(');
if (valsangEngine.getState().suppressedAccentCount < 1) {
  throw new Error('Valsång dämpade inte mikroaccenter när accentfönstret blev fullt.');
}
engine.stop(true);
console.log('  ok   Valsångsdirigenten prioriterar strukturen och begränsar täta mikroaccenter');

const hardForkDelaysBefore = FakeAudioContext.delayCreations;
const hardForkShapersBefore = FakeAudioContext.waveShaperCreations;
await engine.start('hardfork', 24, {
  words: 420,
  characters: 2410,
  averageWordLength: 5.7,
  vowelRatio: .39,
  paragraphs: 8,
  headings: 3,
  headingDepth: 2,
  documentId: 'doc-grenverk',
  contentFingerprint: 284772901,
  documentTitle: 'Grenverk'
});
const hardForkContext = FakeAudioContext.instances.at(-1);
const hardForkInitialState = sandbox.window.HardForkEngine.getState();
if (hardForkInitialState.atmosphereSourceCount !== 5 || !hardForkInitialState.sessionSeed) {
  throw new Error('Hard Fork byggde inte sitt återanvända bakgrundslager eller sessionsfrö.');
}
hardForkContext.currentTime = 10;
FakeAudioContext.startTimes = [];
engine.handleKey('a');
const immediateStarts = FakeAudioContext.startTimes.filter(time => time === 10).length;
const griddedStarts = FakeAudioContext.startTimes.filter(time => Number(time) > 10).length;
if (
  FakeAudioContext.delayCreations < hardForkDelaysBefore + 2 ||
  FakeAudioContext.waveShaperCreations <= hardForkShapersBefore ||
  !immediateStarts ||
  !griddedStarts
) {
  throw new Error('Hard Fork saknar produktionskedja, direktansats eller rytmiskt sextondelslager.');
}
engine.handleKey(' ');
engine.handleKey('.');
hardForkContext.currentTime = 12;
FakeAudioContext.startTimes = [];
const hardForkEngine = sandbox.window.HardForkEngine;
const emptySoloOscillators = FakeAudioContext.oscillatorCreations;
engine.commit('paragraph', { text: '   ' });
if (
  hardForkEngine.getState().paragraphSoloCount !== 0 ||
  hardForkEngine.getState().pendingCommitSoloCount !== 0 ||
  FakeAudioContext.oscillatorCreations !== emptySoloOscillators
) {
  throw new Error('Hard Fork svarade musikaliskt på ett tomt block.');
}
hardForkEngine.resetMemory();
hardForkContext.currentTime = 14;
engine.handleKey('(');
engine.handleKey(')');
engine.handleKey('a');
engine.handleKey('.');
engine.handleKey('Enter');
engine.commit('paragraph', {
  text: 'En samlad riffgest når halva målet.',
  words: 7,
  vowelRatio: .42,
  averageSentenceWords: 7,
  similarityToPrevious: .61,
  goalMilestone: 50
});
const hardForkAccentState = hardForkEngine.getState();
const hardForkAccentPlan = hardForkAccentState.lastParagraphSolo;
if (
  hardForkAccentState.pairedAccentCount !== 2 ||
  hardForkAccentState.composedAccentCount !== 1 ||
  hardForkAccentState.pendingEnterAccent ||
  hardForkAccentPlan?.goalMilestone !== 50 ||
  hardForkAccentPlan?.delayedForSentenceFill ||
  !hardForkAccentPlan?.accentComposition?.includes('sentence-normal') ||
  !hardForkAccentPlan?.accentComposition?.includes('enter') ||
  !hardForkAccentPlan?.accentComposition?.includes('commit') ||
  !hardForkAccentPlan?.accentComposition?.includes('goal-50')
) {
  throw new Error('Hard Fork-dirigenten slog inte samman parl ljud, fill, Enter, commit och målmilstolpe.');
}
for (let index = 0; index < 10; index++) engine.handleKey(index % 2 ? ')' : '(');
if (hardForkEngine.getState().suppressedAccentCount < 1) {
  throw new Error('Hard Fork dämpade inte mikroaccenter när accentfönstret blev fullt.');
}
hardForkEngine.resetMemory();
console.log('  ok   Hard Fork-dirigenten prioriterar strukturen och begränsar täta mikroaccenter');
const soloProfile = {
  id: 'block-grenverk-1',
  text: 'Koden delar sig, men styckets motiv lever vidare genom grenen.',
  words: 11,
  vowelRatio: .41,
  averageSentenceWords: 11,
  similarityToPrevious: .68
};
hardForkEngine.resetMemory();
const soloOscillatorsBefore = FakeAudioContext.oscillatorCreations;
engine.commit('paragraph', soloProfile);
let hardForkState = hardForkEngine.getState();
const firstSolo = hardForkState.lastParagraphSolo;
if (
  hardForkState.paragraphSoloCount !== 1 ||
  firstSolo?.role !== 'paragraph-solo' ||
  firstSolo?.degrees.length < 6 ||
  firstSolo?.degrees.length > 10 ||
  firstSolo?.timbres.length !== firstSolo?.degrees.length ||
  firstSolo?.pans.length !== firstSolo?.degrees.length ||
  firstSolo?.steps.some((step, index) => index > 0 && step <= firstSolo.steps[index - 1]) ||
  !firstSolo?.startsOnGrid ||
  firstSolo?.durationSeconds > 3.2 ||
  hardForkState.pendingCommitSoloCount !== 1 ||
  hardForkState.maxCommitSoloPlans !== 2 ||
  FakeAudioContext.oscillatorCreations !== soloOscillatorsBefore
) {
  throw new Error('Hard Fork byggde inte ett kort, rytmnätsbundet och köbegränsat solo av det invävda stycket.');
}
hardForkEngine.resetMemory();
engine.commit('paragraph', soloProfile);
hardForkState = hardForkEngine.getState();
const repeatedSolo = hardForkState.lastParagraphSolo;
if (
  repeatedSolo.identitySignature !== firstSolo.identitySignature ||
  repeatedSolo.signature === firstSolo.signature ||
  repeatedSolo.variationGeneration <= firstSolo.variationGeneration
) {
  throw new Error('Hard Fork behöll inte textidentiteten samtidigt som ett nytt framförande varierades.');
}
hardForkEngine.resetMemory();
engine.commit('paragraph', {
  text: 'Gren?',
  words: 1,
  vowelRatio: .34,
  averageSentenceWords: 1,
  similarityToPrevious: .12
});
const microSolo = hardForkEngine.getState().lastParagraphSolo;
engine.commit('paragraph', {
  text: Array.from({ length: 120 }, (_, index) => 'grenord' + index).join(' ') + '.',
  words: 120,
  vowelRatio: .42,
  averageSentenceWords: 30,
  similarityToPrevious: .74
});
const longSolo = hardForkEngine.getState().lastParagraphSolo;
if (
  microSolo?.role !== 'microfill' ||
  microSolo?.cadence !== 'question' ||
  microSolo?.degrees.length !== 3 ||
  longSolo?.role !== 'paragraph-solo' ||
  longSolo?.cadence !== 'resolution' ||
  longSolo?.degrees.length <= microSolo.degrees.length ||
  longSolo?.degrees.length > 10 ||
  hardForkEngine.getState().pendingCommitSoloCount !== 2
) {
  throw new Error('Hard Fork lät inte textlängd och sluttecken forma mikrofill respektive styckessolo.');
}
const rapidCommitOscillators = FakeAudioContext.oscillatorCreations;
for (let index = 0; index < 120; index++) {
  engine.commit('paragraph', {
    text: 'Snabb gren ' + index + ' får ersätta en väntande soloplan.',
    words: 9,
    vowelRatio: .4,
    averageSentenceWords: 9,
    similarityToPrevious: (index % 10) / 10
  });
}
hardForkState = hardForkEngine.getState();
if (
  hardForkState.pendingCommitSoloCount !== 2 ||
  hardForkState.commitSoloActive ||
  hardForkState.supersededCommitSolos < 120 ||
  FakeAudioContext.oscillatorCreations !== rapidCommitOscillators
) {
  throw new Error('Hard Fork samlade för många väntande solon eller skapade noder direkt vid 120 snabba commits.');
}
await new Promise(resolve => setTimeout(resolve, 35));
hardForkState = hardForkEngine.getState();
if (
  hardForkState.pendingCommitSoloCount > 2 ||
  !hardForkState.commitSoloActive ||
  hardForkState.pendingCommitSoloCount + Number(hardForkState.commitSoloActive) > 2 ||
  FakeAudioContext.oscillatorCreations - rapidCommitOscillators > 10
) {
  throw new Error('Hard Fork höll inte den faktiska sololane-gränsen när schedulern började spela kön.');
}
const activeLaneOscillators = FakeAudioContext.oscillatorCreations;
for (let index = 0; index < 120; index++) {
  engine.commit('paragraph', {
    text: 'Aktiv gren ' + index + ' samsas med högst ett väntande svar.',
    words: 10,
    vowelRatio: .41,
    averageSentenceWords: 10,
    similarityToPrevious: .5
  });
}
hardForkState = hardForkEngine.getState();
if (
  !hardForkState.commitSoloActive ||
  hardForkState.pendingCommitSoloCount !== 1 ||
  hardForkState.pendingCommitSoloCount + Number(hardForkState.commitSoloActive) !== 2 ||
  FakeAudioContext.oscillatorCreations !== activeLaneOscillators
) {
  throw new Error('Hard Fork överskred två soloplaner när nya commits kom under ett aktivt solo.');
}
engine.stop(true);
hardForkState = hardForkEngine.getState();
if (
  hardForkState.pendingCommitSoloCount !== 0 ||
  hardForkState.commitSoloActive ||
  hardForkState.lastParagraphSolo !== null
) {
  throw new Error('Hard Fork tömde inte solo-lane och väntande svar vid stopp.');
}
await engine.start('hardfork', 24, {
  words: 420,
  characters: 2410,
  averageWordLength: 5.7,
  vowelRatio: .39,
  paragraphs: 8,
  headings: 3,
  headingDepth: 2,
  documentId: 'doc-grenverk',
  contentFingerprint: 284772901,
  documentTitle: 'Grenverk'
});
engine.commit('paragraph', soloProfile);
const newSessionSolo = hardForkEngine.getState().lastParagraphSolo;
if (
  newSessionSolo.identitySignature !== firstSolo.identitySignature ||
  newSessionSolo.documentSeed !== firstSolo.documentSeed ||
  newSessionSolo.sessionSeed === firstSolo.sessionSeed ||
  newSessionSolo.signature === firstSolo.signature
) {
  throw new Error('Hard Fork gav inte samma dokument en stabil identitet och ett nytt framförande i en ny session.');
}
for (let index = 0; index < 181; index++) engine.handleKey('a');
if (!hardForkEngine.getState().concentrationGuardActive) {
  throw new Error('Hard Fork aktiverade inte koncentrationsvakten efter ett långt sammanhängande skrivflöde.');
}
const timerHeatBeforeFinish = hardForkEngine.getState().typeHeat;
engine.setTimerState('finished', 'focus');
const timerFinishedState = hardForkEngine.getState();
if (
  !timerFinishedState.timerResting ||
  timerFinishedState.typeHeat >= timerHeatBeforeFinish
) {
  throw new Error('Hard Fork gav inte ett lugnare musikaliskt läge när skrivtimern tog slut.');
}
engine.setTimerState('running', 'focus');
const timerRestartedState = hardForkEngine.getState();
if (
  timerRestartedState.timerResting ||
  timerRestartedState.typeHeat < timerHeatBeforeFinish ||
  !timerRestartedState.beatActive
) {
  throw new Error('Hard Fork återställde inte beatets energi när ett nytt skrivpass startade.');
}
const resumedHardForkContext = FakeAudioContext.instances.at(-1);
const heatBeforePause = hardForkEngine.getState().typeHeat;
const atmosphereBeforePause = hardForkEngine.getState().atmosphereGain;
resumedHardForkContext.currentTime = 3;
await new Promise(resolve => setTimeout(resolve, 140));
const pausedHardForkState = hardForkEngine.getState();
if (
  !pausedHardForkState.beatActive ||
  pausedHardForkState.isTyping ||
  pausedHardForkState.typeHeat !== heatBeforePause ||
  !pausedHardForkState.thinkingPauseActive ||
  !pausedHardForkState.thinkingBeatHeld ||
  pausedHardForkState.atmosphereGain !== atmosphereBeforePause
) {
  throw new Error('Hard Fork bevarade inte hela det rådande beatet under tankepausen.');
}
resumedHardForkContext.currentTime = 63;
await new Promise(resolve => setTimeout(resolve, 140));
const minutePauseState = hardForkEngine.getState();
if (
  !minutePauseState.beatActive ||
  !minutePauseState.thinkingBeatHeld ||
  minutePauseState.typeHeat !== heatBeforePause ||
  minutePauseState.atmosphereGain !== atmosphereBeforePause
) {
  throw new Error('Hard Fork förändrade det rådande beatet under en minuts tankepaus.');
}
resumedHardForkContext.currentTime = minutePauseState.nextNoteTime - .01;
FakeAudioContext.startTimes = [];
engine.handleKey('a');
const resumedHardForkState = hardForkEngine.getState();
const immediateResumeStarts = FakeAudioContext.startTimes.filter(
  time => time === resumedHardForkContext.currentTime
).length;
if (
  !resumedHardForkState.isTyping ||
  resumedHardForkState.step16 !== minutePauseState.step16 ||
  resumedHardForkState.nextNoteTime !== minutePauseState.nextNoteTime ||
  immediateResumeStarts !== 2
) {
  throw new Error('Hard Fork tappade rytmfasen eller lade ett dubbelslag när skrivandet återupptogs.');
}
engine.stop(true);
console.log('  ok   Hard Fork lugnar beatet vid timerslut och återväcker det vid nästa skrivpass');
console.log('  ok   Hard Fork behåller hela det melodiska beatet genom en minuts tankepaus utan dubbelslag');
console.log('  ok   Hard Fork kombinerar ett fylligt bakgrundslager med textidentitet och unik sessionsvariation');

const nebulapulsOscillatorsBefore = FakeAudioContext.oscillatorCreations;
await engine.start('nebulapuls', 24, {
  words: 430,
  characters: 2550,
  averageWordLength: 5.6,
  vowelRatio: .41,
  averageSentenceWords: 15,
  paragraphs: 8,
  headings: 2,
  connectedness: .64,
  documentId: 'nebula-document',
  documentTitle: 'Ljus över omloppsbanan',
  contentFingerprint: 88241
});
const nebulapulsEngine = sandbox.window.NebulapulsEngine;
let nebulapulsState = nebulapulsEngine.getState();
if (
  nebulapulsState.padVoiceCount !== 4 ||
  ![96, 108, 120, 132].includes(nebulapulsState.bpm) ||
  FakeAudioContext.oscillatorCreations < nebulapulsOscillatorsBefore + 5
) {
  throw new Error('Nebulapuls byggde inte sitt permanenta analoga klangfält eller sin tempoidentitet.');
}

engine.handleKey('n');
engine.handleKey('e');
engine.handleKey('b');
engine.handleKey('(');
engine.handleKey(')');
const paragraphPlan = nebulapulsEngine.commit('paragraph', {
  text: 'Nebulosan rör sig långsamt men pulsen fortsätter.',
  vowelRatio: .43,
  goalMilestone: 50
});
const evolutionBeforeHeading = nebulapulsEngine.getState().evolutionGeneration;
const headingPlan = nebulapulsEngine.commit('heading', {
  text: 'En ny omloppsbana'
});
nebulapulsState = nebulapulsEngine.getState();
if (
  paragraphPlan?.role !== 'text-constellation' ||
  paragraphPlan?.degrees.length < 3 ||
  paragraphPlan?.degrees.length > 10 ||
  paragraphPlan?.goalMilestone !== 50 ||
  headingPlan?.role !== 'harmonic-portal' ||
  nebulapulsState.evolutionGeneration <= evolutionBeforeHeading ||
  nebulapulsState.pairedAccentCount !== 2
) {
  throw new Error('Nebulapuls formade inte textkonstellation, rubrikportal och parljud enligt kontraktet.');
}

for (let index = 0; index < 80; index += 1) {
  engine.commit('paragraph', { text: 'Stycke ' + index + ' rör sig genom samma musikaliska rymd.' });
}
nebulapulsState = nebulapulsEngine.getState();
if (nebulapulsState.pendingResponseCount + Number(nebulapulsState.responseActive) > 2) {
  throw new Error('Nebulapuls överskred gränsen på två samtidiga svarplaner.');
}
engine.setTimerState('finished', 'focus');
if (!nebulapulsEngine.getState().timerResting) {
  throw new Error('Nebulapuls gick inte in i ett lugnare timerläge.');
}
engine.setTimerState('running', 'focus');
if (nebulapulsEngine.getState().timerResting) {
  throw new Error('Nebulapuls återväcktes inte när skrivpasset startade.');
}
engine.stop(true);
if (nebulapulsEngine.getState().padVoiceCount !== 0) {
  throw new Error('Nebulapuls tömde inte sitt permanenta klangfält vid stopp.');
}
console.log('  ok   Nebulapuls varierar flerskaligt, svarar på text och håller resursgränserna');

const typewriter = sandbox.testTypewriter;
const typewriterThemes = ['mekanisk', 'reseskrivare', 'elektrisk', 'dampad'];
let typewriterPassed = 0;

for (const theme of typewriterThemes) {
  if (!sandbox.testTypewriterThemes[theme]) throw new Error('Skrivmaskinstemat saknas: ' + theme);
  if (!await typewriter.start(theme, 18)) throw new Error('Skrivmaskinsstart misslyckades: ' + theme);
  if (!typewriter.isPlaying() || !typewriter.isReady() || typewriter.theme() !== theme) {
    throw new Error('Fel aktivt skrivmaskinstema: ' + theme);
  }

  const buffersAfterPreparation = FakeAudioContext.bufferCreations;
  typewriter.preview();
  for (const key of ['a', ' ', 'Backspace', '.', 'Enter']) typewriter.handleKey(key);
  if (FakeAudioContext.bufferCreations !== buffersAfterPreparation) {
    throw new Error('Skrivmaskinen byggde nya ljudbufferter under tangenttryckning: ' + theme);
  }
  typewriter.setVolume(10);
  typewriter.stop(true);

  if (typewriter.isPlaying()) throw new Error('Skrivmaskinsstopp misslyckades: ' + theme);
  typewriterPassed += 1;
  console.log('  ok   ' + theme + ' ger tangentfeedback och stängs');
}

if (FakeAudioContext.waveShaperCreations < typewriterThemes.length) {
  throw new Error('Skrivmaskinens soft clipper testades inte för varje tema.');
}
console.log('  ok   skrivmaskinens soft clipper används');

await engine.start('valsang', 24, {});
const interruptedSoundContext = FakeAudioContext.instances.at(-1);
interruptedSoundContext.state = 'interrupted';
const soundResumeCalls = interruptedSoundContext.resumeCalls;
engine.handleKey('a');
if (
  interruptedSoundContext.resumeCalls !== soundResumeCalls + 1 ||
  interruptedSoundContext.state !== 'running'
) {
  throw new Error('Valsång återväckte inte en avbruten ljudkontext.');
}
engine.stop(true);
console.log('  ok   dynamiskt ljudrum återväcks efter ljudavbrott');

await typewriter.start('reseskrivare', 18);
const suspendedTypewriterContext = FakeAudioContext.instances.at(-1);
suspendedTypewriterContext.state = 'suspended';
const typewriterResumeCalls = suspendedTypewriterContext.resumeCalls;
typewriter.handleKey('a');
if (
  suspendedTypewriterContext.resumeCalls !== typewriterResumeCalls + 1 ||
  suspendedTypewriterContext.state !== 'running'
) {
  throw new Error('Skrivmaskinen återväckte inte en pausad ljudkontext.');
}
typewriter.stop(true);
console.log('  ok   skrivmaskinen återväcks efter ljudavbrott');

FakeAudioContext.deferResume = true;

const soundBuffersBeforeCancel = FakeAudioContext.bufferCreations;
const cancelledSoundStart = engine.start('glantan', 24, {});
if (engine.isReady()) throw new Error('Ljudrummet var klart innan ljudkontexten hade väckts.');
engine.stop(true);
FakeAudioContext.releaseResumes();
if (await cancelledSoundStart || engine.isPlaying()) {
  throw new Error('Ett stoppat ljudrum rapporterade ändå en färdig start.');
}
if (FakeAudioContext.bufferCreations !== soundBuffersBeforeCancel + 1) {
  throw new Error('Ljudrummet byggde mer än den tysta väckningsbufferten trots att starten avbröts.');
}
console.log('  ok   ljudrummets väntande start kan avbrytas');

const firstSoundStart = engine.start('regnvav', 24, {});
const latestSoundStart = engine.start('djupstrom', 24, {});
FakeAudioContext.releaseResumes();
if (await firstSoundStart || !await latestSoundStart || engine.theme() !== 'djupstrom') {
  throw new Error('Senaste ljudrumsvalet vann inte över en äldre väntande start.');
}
engine.stop(true);
console.log('  ok   senaste ljudrumsstarten vinner vid snabb växling');

const typewriterBuffersBeforeCancel = FakeAudioContext.bufferCreations;
const cancelledTypewriterStart = typewriter.start('mekanisk', 18);
if (typewriter.isReady()) throw new Error('Skrivmaskinsljudet var klart innan ljudkontexten hade väckts.');
typewriter.stop(true);
FakeAudioContext.releaseResumes();
if (await cancelledTypewriterStart || typewriter.isPlaying()) {
  throw new Error('Ett stoppat skrivmaskinsljud rapporterade ändå en färdig start.');
}
if (FakeAudioContext.bufferCreations !== typewriterBuffersBeforeCancel + 1) {
  throw new Error('Skrivmaskinsljudet byggde mer än den tysta väckningsbufferten trots att starten avbröts.');
}
console.log('  ok   skrivmaskinens väntande start kan avbrytas');

const firstTypewriterStart = typewriter.start('reseskrivare', 18);
const latestTypewriterStart = typewriter.start('dampad', 18);
FakeAudioContext.releaseResumes();
if (await firstTypewriterStart || !await latestTypewriterStart || typewriter.theme() !== 'dampad') {
  throw new Error('Senaste skrivmaskinsvalet vann inte över en äldre väntande start.');
}
typewriter.stop(true);
console.log('  ok   senaste skrivmaskinsstarten vinner vid snabb växling');

FakeAudioContext.deferResume = false;

console.log(`\nLjudrum: ${passed} av ${themes.length} ljudlandskap godkända.`);
console.log(`Skrivmaskiner: ${typewriterPassed} av ${typewriterThemes.length} teman godkända.\n`);
