import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync('index.html', 'utf8');
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
  start() {}
  stop() { this.listeners.ended?.(); }
}

class FakeAudioContext {
  constructor() {
    this.sampleRate = 8000;
    this.currentTime = 0;
    this.state = 'running';
    this.destination = new FakeNode();
  }

  createBuffer(channels, length) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { getChannelData: index => data[index] };
  }

  createBufferSource() { return new FakeNode(); }
  createBiquadFilter() { return new FakeNode(); }
  createGain() { return new FakeNode(); }
  createOscillator() { return new FakeNode(); }
  createStereoPanner() { return new FakeNode(); }
  createDynamicsCompressor() { return new FakeNode(); }
  resume() { return Promise.resolve(); }
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
}

const sandbox = {
  window: { AudioContext: FakeAudioContext },
  Math,
  Date,
  Promise,
  Set,
  Float32Array,
  setTimeout,
  clearTimeout,
  clamp: (value, min, max) => Math.max(min, Math.min(max, value))
};

vm.createContext(sandbox);
vm.runInContext(soundSource, sandbox);

const engine = sandbox.testSoundscape;
const themes = ['glantan', 'regnvav', 'djupstrom', 'nattljus', 'ordfalt', 'sambandsvav', 'strukturklang'];
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
  if (!engine.isPlaying() || engine.theme() !== theme) {
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

const typewriter = sandbox.testTypewriter;
const typewriterThemes = ['mekanisk', 'reseskrivare', 'elektrisk', 'dampad'];
let typewriterPassed = 0;

for (const theme of typewriterThemes) {
  if (!sandbox.testTypewriterThemes[theme]) throw new Error('Skrivmaskinstemat saknas: ' + theme);
  if (!await typewriter.start(theme, 18)) throw new Error('Skrivmaskinsstart misslyckades: ' + theme);
  if (!typewriter.isPlaying() || typewriter.theme() !== theme) {
    throw new Error('Fel aktivt skrivmaskinstema: ' + theme);
  }

  for (const key of ['a', ' ', 'Backspace', '.', 'Enter']) typewriter.handleKey(key);
  typewriter.setVolume(10);
  typewriter.stop(true);

  if (typewriter.isPlaying()) throw new Error('Skrivmaskinsstopp misslyckades: ' + theme);
  typewriterPassed += 1;
  console.log('  ok   ' + theme + ' ger tangentfeedback och stängs');
}

console.log(`\nLjudrum: ${passed} av ${themes.length} ljudlandskap godkända.`);
console.log(`Skrivmaskiner: ${typewriterPassed} av ${typewriterThemes.length} teman godkända.\n`);
