import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync('index.html', 'utf8');
const valsangSource = readFileSync('valsang-engine.js', 'utf8');
const hardForkSource = readFileSync('hardfork-engine.js', 'utf8');
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
  constructor() {
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
  stop() { this.listeners.ended?.(); }
}

class FakeAudioContext {
  static deferResume = false;
  static pendingResumes = [];
  static bufferCreations = 0;
  static waveShaperCreations = 0;
  static oscillatorCreations = 0;
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

  createBufferSource() { return new FakeNode(); }
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
    return new FakeNode();
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
  'hardfork'
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
engine.handleKey('a');
engine.handleKey('s');
engine.handleKey('.');
const generationBeforeEnter = valsangEngine.getState().voiceGeneration;
engine.handleKey('Enter');
if (valsangEngine.getState().voiceGeneration !== generationBeforeEnter) {
  throw new Error('Enter roterade Valsångens röst trots att inget block hade vävts in.');
}
const oscillatorsBeforeCommits = FakeAudioContext.oscillatorCreations;
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
  valsangState.lastFadeSeconds < 8 ||
  valsangState.lastFadeSeconds > 14
) {
  throw new Error('Ett invävt stycke startade inte exakt en ny, långsamt övertonad Valsångsröst.');
}
engine.commit('heading', {
  text: 'Djupare vatten',
  level: 2,
  vowelRatio: .48,
  averageSentenceWords: 4,
  similarityToPrevious: .28
});
valsangState = valsangEngine.getState();
if (valsangState.lastCommitKind !== 'heading' || valsangState.foregroundVoice !== 2) {
  throw new Error('En rubrik skapade inte en tydlig temaväxling i Valsången.');
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
  FakeAudioContext.oscillatorCreations !== oscillatorsBeforeCommits
) {
  throw new Error('Valsångens styckesväxling växte utanför den fasta tre-rösterspoolen.');
}
engine.stop(true);
if (valsangEngine.getState().voicePoolSize !== 0) {
  throw new Error('Valsångens röstpool tömdes inte vid stopp.');
}
console.log('  ok   Valsång skiljer frasslut från blockcommit och korsfadar högst tre dokumentstyrda röster');

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
  documentTitle: 'Grenverk'
});
const hardForkContext = FakeAudioContext.instances.at(-1);
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
engine.stop(true);
console.log('  ok   Hard Fork kombinerar direkt tangentansats med sequencer, distortion och stereodelay');

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
