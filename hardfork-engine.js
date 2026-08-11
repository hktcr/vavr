window.HardForkEngine = (function() {
    let ctx = null;
    let masterGain = null;
    let globalVolume = 0.72;
    let effectDepth = 1.0;

    // Constants
    const ALPHABET = "abcdefghijklmnopqrstuvwxyzåäö";
    const BPM = 125;
    const SIXTEENTH_DUR = 60 / BPM / 4;
    const LOOKAHEAD = 0.12;
    const MAX_COMMIT_SOLO_PLANS = 2;
    const GROOVE_PATTERNS = [
        { bass: [0, 3, 8, 11], warmBass: [3, 11], extraKick: [4, 12], hats: [2, 10], warmHats: [6, 14], ostinato: [0, 2, 4, 6, 8, 10, 12, 14] },
        { bass: [0, 5, 8, 11], warmBass: [5, 11], extraKick: [5, 12], hats: [2, 10], warmHats: [6, 13], ostinato: [0, 2, 4, 7, 8, 10, 12, 15] },
        { bass: [0, 3, 8, 14], warmBass: [3, 14], extraKick: [4, 11], hats: [2, 9], warmHats: [6, 14], ostinato: [0, 3, 4, 6, 8, 11, 12, 14] },
        { bass: [0, 6, 8, 11], warmBass: [6, 11], extraKick: [6, 12], hats: [2, 10], warmHats: [7, 14], ostinato: [0, 2, 5, 6, 8, 10, 13, 14] }
    ];

    // Scale
    const scale = [0, 3, 5, 7, 10]; // Minor pentatonic

    // Audio nodes
    let synthBus, dryGain, sendGain;
    let compressor, waveshaper;
    let delayL, delayR, delayFB_L, delayFB_R, delayPanL, delayPanR;
    let masterFilter;
    let noiseBuffer = null;
    let atmosphereBus = null;
    let atmosphereFilter = null;
    let atmosphereNoise = null;
    let atmosphereLfo = null;
    let atmosphereLfoDepth = null;
    let atmosphereOscillators = [];
    let atmosphereLevels = [];

    // State
    let traces = [];
    let activeAckordDegrees = [];
    let isTyping = false;
    let beatActive = false;
    let typeHeat = 0;
    let lastKeyTime = 0;
    let heatInterval = null;
    const TYPING_PAUSE_THRESHOLD = 0.45;
    let timerResting = false;
    let heatBeforeTimerRest = 0;

    // Sequencer State
    let schedulerInterval = null;
    let nextNoteTime = 0;
    let step16 = 0;
    let barNumber = 0;
    let currentChordOffset = 0;
    let currentKeyShift = 0;
    let isOutro = false;

    // Melody State
    let lastCharIndex = -1; // A1
    let currentMelDegree = 4;
    let melodyBuffer = []; // Last 8 notes for fills
    let currentSentenceLen = 0;
    let fillScheduledForNextBar = false;
    let fillGain = 0;
    let isFillBar = false;

    // Punctuation as Production (Part B)
    let pendingFillVariant = 'normal';   // 'normal' | 'question' | 'exclaim'
    let activeFillVariant = 'normal';
    let delayBloomUntilBar = -1;
    let sweepUntilTime = 0;
    let lastGlitchTime = 0;

    // Block response
    let paragraphSoloCount = 0;
    let headingStingCount = 0;
    let lastParagraphSolo = null;
    let lastBlockResponse = null;
    let pendingCommitSolos = [];
    let activeCommitSolo = null;
    let supersededCommitSolos = 0;
    let commitSequence = 0;
    let gestureSequence = 0;
    let sustainedGestureCount = 0;

    // Sentence Memory (Part C)
    let lastHeadingCount = 0;
    let M = [0, 2, 4, 2, 0, 2, 4, 7].map(Number);
    let M_pending = null;
    let sentenceMelody = [];

    // PRNG
    function mulberry32(a) {
        return function() {
            var t = a += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }
    }
    let prng = Math.random;
    let sessionSeed = 0;
    let documentSeed = 0;
    let contentSeed = 0;
    let currentGrooveFamily = 0;
    let currentTextureFamily = 0;
    let currentSwing = 0.56;
    let contextStats = {
        words: 0,
        paragraphs: 0,
        headings: 0,
        lastHeadingLevel: 0,
        harmonicShiftCount: 0,
        vowelRatio: 0.38,
        g: 1,
        documentTitle: ''
    };

    function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }
    function mixSeeds(...values) {
        let hash = 2166136261;
        for (const value of values) {
            hash ^= Number(value) >>> 0;
            hash = Math.imul(hash, 16777619);
            hash ^= hash >>> 13;
        }
        return hash >>> 0;
    }
    function createSessionSeed() {
        const randomPart = Math.floor(Math.random() * 0xFFFFFFFF) >>> 0;
        const clockPart = Date.now() >>> 0;
        const performancePart = typeof performance !== 'undefined'
            ? Math.floor(performance.now() * 1000) >>> 0
            : 0;
        return mixSeeds(randomPart, clockPart, performancePart || 1);
    }
    function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }
    function degreeToMidi(degree, root) {
        const octave = Math.floor(degree / scale.length);
        const pitchClass = scale[((degree % scale.length) + scale.length) % scale.length];
        return root + pitchClass + (octave * 12);
    }

    function getStats() {
        return contextStats;
    }

    function setContext(profile = {}) {
        const previousDocumentSeed = documentSeed;
        const words = Math.max(0, Number(profile.words) || 0);
        const averageWordLength = clamp(Number(profile.averageWordLength) || 5, 2, 12);
        const N = Math.max(0, Number(profile.characters) || words * averageWordLength);
        contextStats = {
            ...contextStats,
            words,
            wordCount: words,
            paragraphs: Math.max(0, Number(profile.paragraphs) || 0),
            headings: Math.max(0, Number(profile.headings) || 0),
            lastHeadingLevel: Math.max(0, Number(profile.headingDepth) || 0),
            harmonicShiftCount: Math.max(0, Number(profile.harmonicShiftCount) || 0),
            vowelRatio: clamp(Number(profile.vowelRatio) || 0.38, 0.2, 0.65),
            g: 40 / (40 + N),
            cohesion: clamp(Number(profile.cohesion) || 0, 0, 1),
            connectedness: clamp(Number(profile.connectedness) || 0, 0, 1),
            characters: N,
            averageWordLength,
            averageSentenceWords: clamp(Number(profile.averageSentenceWords) || 12, 2, 60),
            documentId: String(profile.documentId || ''),
            documentTitle: String(profile.documentTitle || '')
        };
        documentSeed = mixSeeds(
            textSignature(contextStats.documentId),
            textSignature(contextStats.documentTitle),
            0x444F4355
        );
        contentSeed = mixSeeds(
            Number(profile.contentFingerprint) || 0,
            Math.round(contextStats.vowelRatio * 1000),
            Math.round(averageWordLength * 100),
            Math.round(contextStats.averageSentenceWords * 10),
            contextStats.characters,
            contextStats.paragraphs,
            contextStats.headings
        );
        if (!previousDocumentSeed || previousDocumentSeed !== documentSeed) {
            morphAtmosphere(2.6);
        }
    }

    function createNoiseBuffer() {
        if (noiseBuffer) return;
        const size = ctx.sampleRate * 1.0; // 1s
        noiseBuffer = ctx.createBuffer(1, size, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        const noiseRandom = mulberry32(mixSeeds(sessionSeed, 0x4E4F4953));
        for (let i = 0; i < size; i++) {
            output[i] = noiseRandom() * 2 - 1;
        }
    }

    function createAtmosphere() {
        const identityRandom = mulberry32(mixSeeds(sessionSeed, 0x41544D4F));
        atmosphereBus = ctx.createGain();
        atmosphereBus.gain.value = 0.0001;
        atmosphereFilter = ctx.createBiquadFilter();
        atmosphereFilter.type = 'lowpass';
        atmosphereFilter.frequency.value = 260;
        atmosphereFilter.Q.value = 0.7;
        atmosphereBus.connect(atmosphereFilter);
        atmosphereFilter.connect(synthBus);

        atmosphereOscillators = [0, 1, 2].map((index) => {
            const oscillator = ctx.createOscillator();
            const level = ctx.createGain();
            oscillator.type = index === 0 ? 'sine' : 'triangle';
            oscillator.frequency.value = 38 * [1, 1.5, 2][index];
            oscillator.detune.value = (identityRandom() - .5) * 9;
            level.gain.value = [0.34, 0.17, 0.09][index];
            oscillator.connect(level);
            level.connect(atmosphereBus);
            oscillator.start();
            atmosphereLevels.push(level);
            return oscillator;
        });

        atmosphereNoise = ctx.createBufferSource();
        const noiseFilter = ctx.createBiquadFilter();
        const noiseLevel = ctx.createGain();
        atmosphereNoise.buffer = noiseBuffer;
        atmosphereNoise.loop = true;
        atmosphereNoise.playbackRate.value = .31 + identityRandom() * .18;
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = 118 + identityRandom() * 90;
        noiseFilter.Q.value = 1.2;
        noiseLevel.gain.value = .065;
        atmosphereNoise.connect(noiseFilter);
        noiseFilter.connect(noiseLevel);
        noiseLevel.connect(atmosphereBus);
        atmosphereNoise.start();

        atmosphereLfo = ctx.createOscillator();
        atmosphereLfoDepth = ctx.createGain();
        atmosphereLfo.type = 'sine';
        atmosphereLfo.frequency.value = .018 + identityRandom() * .024;
        atmosphereLfoDepth.gain.value = 46 + identityRandom() * 54;
        atmosphereLfo.connect(atmosphereLfoDepth);
        atmosphereLfoDepth.connect(atmosphereFilter.frequency);
        atmosphereLfo.start();
    }

    function morphAtmosphere(seconds = 1.6) {
        if (!ctx || !atmosphereFilter || !atmosphereOscillators.length) return;
        const growthBand = Math.floor((contextStats.words || 0) / 24);
        const morphRandom = mulberry32(mixSeeds(
            sessionSeed,
            documentSeed,
            contentSeed,
            growthBand,
            currentGrooveFamily,
            currentTextureFamily
        ));
        const now = ctx.currentTime;
        const root = 34 + (documentSeed % 9) + morphRandom() * 4;
        const ratios = currentTextureFamily % 3 === 0
            ? [1, 1.5, 2]
            : currentTextureFamily % 3 === 1 ? [1, 1.6, 2.12] : [1, 1.42, 1.92];
        atmosphereOscillators.forEach((oscillator, index) => {
            oscillator.frequency.setTargetAtTime(root * ratios[index], now, Math.max(.18, seconds / 3));
        });
        atmosphereFilter.frequency.setTargetAtTime(
            205 + morphRandom() * 150 + contextStats.vowelRatio * 120,
            now,
            Math.max(.2, seconds / 3)
        );
        if (atmosphereLfo) {
            atmosphereLfo.frequency.setTargetAtTime(.014 + morphRandom() * .035, now, .8);
        }
    }

    function wakeAtmosphere() {
        if (!atmosphereBus || !ctx) return;
        const target = (.016 + Math.min(1, typeHeat) * .011) * effectDepth;
        atmosphereBus.gain.setTargetAtTime(target, ctx.currentTime, .45);
    }

    function restAtmosphere() {
        if (!atmosphereBus || !ctx) return;
        atmosphereBus.gain.setTargetAtTime(.0001, ctx.currentTime, 2.4);
    }

    function destroyAtmosphere() {
        for (const source of [...atmosphereOscillators, atmosphereNoise, atmosphereLfo]) {
            if (!source) continue;
            try { source.stop(); } catch (error) {}
            try { source.disconnect(); } catch (error) {}
        }
        for (const node of [...atmosphereLevels, atmosphereLfoDepth, atmosphereFilter, atmosphereBus]) {
            if (!node) continue;
            try { node.disconnect(); } catch (error) {}
        }
        atmosphereOscillators = [];
        atmosphereLevels = [];
        atmosphereNoise = null;
        atmosphereLfo = null;
        atmosphereLfoDepth = null;
        atmosphereFilter = null;
        atmosphereBus = null;
    }

    function makeDistortionCurve(amount) {
        let k = amount, n_samples = 44100, curve = new Float32Array(n_samples), deg = Math.PI / 180, i = 0, x;
        for ( ; i < n_samples; ++i ) {
            x = i * 2 / n_samples - 1;
            curve[i] = ( 3 + k ) * x * 20 * deg / ( Math.PI + k * Math.abs(x) );
        }
        return curve;
    }

    function init(audioContext, destination) {
        ctx = audioContext || ctx || new (window.AudioContext || window.webkitAudioContext)();
        if (masterGain) return; // Already initialized

        sessionSeed = createSessionSeed();
        prng = mulberry32(sessionSeed);
        commitSequence = 0;
        gestureSequence = 0;

        createNoiseBuffer();

        masterGain = ctx.createGain();
        masterGain.gain.value = globalVolume;

        synthBus = ctx.createGain();
        synthBus.gain.value = 1.0;
        createAtmosphere();
        
        masterFilter = ctx.createBiquadFilter();
        masterFilter.type = 'lowpass';
        masterFilter.frequency.value = 18000;

        waveshaper = ctx.createWaveShaper();
        waveshaper.curve = makeDistortionCurve(10);
        waveshaper.oversample = '2x';

        compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -18;
        compressor.knee.value = 12;
        compressor.ratio.value = 4;
        compressor.attack.value = 0.01;
        compressor.release.value = 0.15;

        synthBus.connect(masterFilter);
        masterFilter.connect(waveshaper);
        waveshaper.connect(compressor);

        dryGain = ctx.createGain(); dryGain.gain.value = 1.0;
        sendGain = ctx.createGain(); sendGain.gain.value = 0.4;

        compressor.connect(dryGain);
        compressor.connect(sendGain);
        dryGain.connect(masterGain);

        delayL = ctx.createDelay(); delayL.delayTime.value = SIXTEENTH_DUR * 3;
        delayR = ctx.createDelay(); delayR.delayTime.value = SIXTEENTH_DUR * 4;
        delayFB_L = ctx.createGain(); delayFB_L.gain.value = 0.25;
        delayFB_R = ctx.createGain(); delayFB_R.gain.value = 0.25;
        delayPanL = ctx.createStereoPanner(); delayPanL.pan.value = -0.8;
        delayPanR = ctx.createStereoPanner(); delayPanR.pan.value = 0.8;
        
        const delayFilterL = ctx.createBiquadFilter(); delayFilterL.type = 'lowpass'; delayFilterL.frequency.value = 3000;
        const delayFilterR = ctx.createBiquadFilter(); delayFilterR.type = 'lowpass'; delayFilterR.frequency.value = 3000;

        sendGain.connect(delayL); delayL.connect(delayFilterL); delayFilterL.connect(delayPanL); delayPanL.connect(masterGain); delayFilterL.connect(delayFB_R);
        sendGain.connect(delayR); delayR.connect(delayFilterR); delayFilterR.connect(delayPanR); delayPanR.connect(masterGain); delayFilterR.connect(delayFB_L);
        delayFB_R.connect(delayR); delayFB_L.connect(delayL);

        masterGain.connect(destination || ctx.destination);
        ctx.synthBus = synthBus;

        heatInterval = setInterval(() => {
            if (
                ctx &&
                isTyping &&
                ctx.currentTime - lastKeyTime > TYPING_PAUSE_THRESHOLD
            ) {
                // En tankepaus fryser den musikaliska intensiteten. Rytmklockan
                // fortsätter i samma fas och återstartas därför inte vid nästa tecken.
                isTyping = false;
            }
        }, 100);

        schedulerInterval = setInterval(schedule, 25);
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', handleVisibilityChange);
        }
    }

    function setVolume(val) {
        globalVolume = val;
        if (masterGain) masterGain.gain.setTargetAtTime(val, ctx.currentTime, 0.1);
    }

    function setDepth(val) {
        effectDepth = val;
        if (sendGain) sendGain.gain.setTargetAtTime(0.2 + (0.4 * val), ctx.currentTime, 0.1);
    }

    function setTimerState(state, mode = 'focus') {
        if (!ctx) return;
        if (state === 'finished') {
            heatBeforeTimerRest = Math.max(heatBeforeTimerRest, typeHeat, .55);
            timerResting = true;
            typeHeat = Math.min(typeHeat, .16);
            if (beatActive) wakeAtmosphere();
            return;
        }
        if (state === 'running' && mode === 'focus') {
            typeHeat = Math.max(typeHeat, heatBeforeTimerRest, .55);
            heatBeforeTimerRest = 0;
            timerResting = false;
            if (!beatActive) {
                beatActive = true;
                nextNoteTime = Math.ceil((ctx.currentTime + 0.02) / SIXTEENTH_DUR) * SIXTEENTH_DUR;
            }
            wakeAtmosphere();
            return;
        }
        if (state === 'idle') {
            timerResting = false;
            heatBeforeTimerRest = 0;
        }
    }

    function handleVisibilityChange() {
        if (document.hidden) {
            isTyping = false;
        } else if (ctx && nextNoteTime < ctx.currentTime) {
            // Behåll aktuellt rytmsteg. Flytta bara fram klockan om webbläsaren
            // faktiskt har lämnat den efter sig under avbrottet.
            nextNoteTime = ctx.currentTime + 0.05;
        }
    }

    function resetMemory() {
        M = [0, 2, 4, 2, 0, 2, 4, 7].map(Number);
        M_pending = null;
        sentenceMelody = [];
        melodyBuffer = [];
        isTyping = false;
        beatActive = false;
        isOutro = false;
        isFillBar = false;
        fillScheduledForNextBar = false;
        currentSentenceLen = 0;
        lastCharIndex = -1;
        currentMelDegree = 4;
        pendingFillVariant = 'normal';
        activeFillVariant = 'normal';
        delayBloomUntilBar = -1;
        sweepUntilTime = 0;
        lastGlitchTime = 0;
        typeHeat = 0;
        timerResting = false;
        heatBeforeTimerRest = 0;
        lastHeadingCount = 0;
        step16 = 0;
        barNumber = 0;
        nextNoteTime = 0;
        currentChordOffset = 0;
        currentKeyShift = 0;
        traces = [];
        activeAckordDegrees = [];
        paragraphSoloCount = 0;
        headingStingCount = 0;
        lastParagraphSolo = null;
        lastBlockResponse = null;
        pendingCommitSolos = [];
        activeCommitSolo = null;
        supersededCommitSolos = 0;
        currentGrooveFamily = 0;
        currentTextureFamily = 0;
        currentSwing = 0.56;
        sustainedGestureCount = 0;
    }

    function destroy() {
        if (heatInterval) clearInterval(heatInterval);
        if (schedulerInterval) clearInterval(schedulerInterval);
        if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        }
        destroyAtmosphere();
        if (masterGain) {
            const oldGain = masterGain;
            oldGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
            setTimeout(() => { try { oldGain.disconnect(); } catch(e) {} }, 200);
            masterGain = null;
        }
        resetMemory();
        noiseBuffer = null;
        heatInterval = null;
        schedulerInterval = null;
        sessionSeed = 0;
        documentSeed = 0;
        contentSeed = 0;
        ctx = null;
    }

    // --- Audio Playback ---

    function duckSidechain(time) {
        synthBus.gain.setValueAtTime(synthBus.gain.value, time);
        synthBus.gain.exponentialRampToValueAtTime(0.4, time + 0.02);
        synthBus.gain.linearRampToValueAtTime(1.0, time + 0.38);
    }

    function playKick(time) {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(150, time); osc.frequency.exponentialRampToValueAtTime(30, time + 0.1);
        gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(0.4, time + 0.01); gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
        osc.connect(gain); gain.connect(compressor);
        osc.start(time); osc.stop(time + 0.3);
        osc.onended = () => { gain.disconnect(); };
        duckSidechain(time);
    }

    function playBass(time, isOctave = false, duration = 0.28) {
        const osc1 = ctx.createOscillator(); osc1.type = 'sine';
        const osc2 = ctx.createOscillator(); osc2.type = 'triangle';
        const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 600;
        const gain = ctx.createGain();
        
        let root = 48 + currentKeyShift + currentChordOffset - 12;
        if (isOctave) root += 12;
        const freq = midiToFreq(root);
        
        osc1.frequency.setValueAtTime(freq, time); osc2.frequency.setValueAtTime(freq * 2, time);
        
        const osc2Gain = ctx.createGain(); osc2Gain.gain.value = 0.4;
        osc2.connect(osc2Gain);
        
        osc1.connect(filter); osc2Gain.connect(filter); filter.connect(gain); gain.connect(synthBus);
        
        gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(0.3, time + 0.01); gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
        
        osc1.start(time); osc2.start(time);
        osc1.stop(time + duration + 0.1); osc2.stop(time + duration + 0.1);
        osc1.onended = () => { try { filter.disconnect(); gain.disconnect(); osc2Gain.disconnect(); } catch(e){} };
    }

    function playHat(time, pan = 0, isOpen = false, volMod = 1.0) {
        const source = ctx.createBufferSource(); source.buffer = noiseBuffer;
        const filter = ctx.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = 5000;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(0.05 * volMod, time + 0.01);
        const dur = isOpen ? 0.2 : 0.05;
        gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        
        const panner = ctx.createStereoPanner(); panner.pan.value = pan;
        source.connect(filter); filter.connect(gain); gain.connect(panner); panner.connect(synthBus);
        
        source.start(time); source.stop(time + dur + 0.1);
        source.onended = () => { try { filter.disconnect(); gain.disconnect(); panner.disconnect(); } catch(e){} };
    }

    function playSnare(time) {
        const noise = ctx.createBufferSource(); noise.buffer = noiseBuffer;
        const noiseFilter = ctx.createBiquadFilter(); noiseFilter.type = 'bandpass'; noiseFilter.frequency.value = 2000;
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0, time); noiseGain.gain.linearRampToValueAtTime(0.15, time + 0.01); noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
        noise.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(synthBus);
        
        const osc = ctx.createOscillator(); osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, time); osc.frequency.exponentialRampToValueAtTime(100, time + 0.1);
        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(0, time); oscGain.gain.linearRampToValueAtTime(0.2, time + 0.005); oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
        osc.connect(oscGain); oscGain.connect(synthBus);
        
        noise.start(time); osc.start(time);
        noise.stop(time + 0.25); osc.stop(time + 0.15);
        noise.onended = () => { try { noiseFilter.disconnect(); noiseGain.disconnect(); oscGain.disconnect(); } catch(e){} };
    }

    function playCrash(time, volMod = 1.0) {
        const noise = ctx.createBufferSource(); noise.buffer = noiseBuffer;
        const filter = ctx.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = 6000;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(0.2 * volMod, time + 0.02); gain.gain.exponentialRampToValueAtTime(0.001, time + 0.8);
        noise.connect(filter); filter.connect(gain); gain.connect(synthBus);
        noise.start(time); noise.stop(time + 1.0);
        noise.onended = () => { try { filter.disconnect(); gain.disconnect(); } catch(e){} };
    }

    function playGlitch(time, volMod = 1.0) {
        const now = performance.now();
        if (now - lastGlitchTime < 300) {
            playRiser(time, 0.05, 0.03);
            return;
        }
        lastGlitchTime = now;
        const osc = ctx.createOscillator(); osc.type = 'sawtooth';
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(800, time); osc.frequency.setValueAtTime(1200, time + 0.05);
        osc.frequency.setValueAtTime(400, time + 0.1); osc.frequency.setValueAtTime(2000, time + 0.15);
        gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(0.1 * volMod, time + 0.01);
        gain.gain.setValueAtTime(0.1 * volMod, time + 0.18); gain.gain.linearRampToValueAtTime(0, time + 0.2);
        osc.connect(gain); gain.connect(synthBus);
        osc.start(time); osc.stop(time + 0.25);
        osc.onended = () => { try { gain.disconnect(); } catch(e){} };
    }

    function playRiser(time, dur, vol) {
        const src = ctx.createBufferSource(); src.buffer = noiseBuffer; src.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'highpass';
        f.frequency.setValueAtTime(800, time);
        f.frequency.exponentialRampToValueAtTime(6000, time + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(vol, time + dur);
        g.gain.exponentialRampToValueAtTime(0.0001, time + dur + 0.05);
        src.connect(f); f.connect(g); g.connect(synthBus);
        src.start(time); src.stop(time + dur + 0.1);
        src.onended = () => { try { f.disconnect(); g.disconnect(); } catch(e){} };
    }

    function playStab(time) {
        for (const d of [0, 1, 3]) playPluck(time, d, 1.0, 0.15, 1.2);
    }

    function playPluck(time, degree, velocity, duration = 0.3, volMod = 1.0, character = {}) {
        const timbres = [
            ['sawtooth', 'sawtooth'],
            ['triangle', 'sawtooth'],
            ['square', 'triangle']
        ];
        const timbre = timbres[Math.abs(Number(character.timbre) || 0) % timbres.length];
        const osc = ctx.createOscillator(); osc.type = timbre[0];
        const osc2 = ctx.createOscillator(); osc2.type = timbre[1];
        const detune = clamp(Number(character.detune) || 7, 2, 14);
        osc.detune.value = -detune; osc2.detune.value = detune;
        
        const filter = ctx.createBiquadFilter(); filter.type = 'lowpass';
        const brightness = clamp(Number(character.brightness) || 1, .72, 1.24);
        const filterMax = (1000 + (3000 * Math.min(1, typeHeat))) * brightness;
        filter.frequency.setValueAtTime(400, time);
        filter.frequency.exponentialRampToValueAtTime(filterMax * effectDepth, time + 0.05);
        filter.frequency.exponentialRampToValueAtTime(400, time + duration);
        
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.1 * velocity * volMod, time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration - 0.05);
        
        const freq = midiToFreq(degreeToMidi(degree, 48 + currentKeyShift));
        osc.frequency.setValueAtTime(freq, time); osc2.frequency.setValueAtTime(freq, time);
        
        const oscGain = ctx.createGain(); oscGain.gain.value = 0.35;
        const osc2Gain = ctx.createGain(); osc2Gain.gain.value = 0.35 * Math.min(1, typeHeat);
        const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
        if (panner) panner.pan.value = clamp(Number(character.pan) || 0, -.42, .42);
        
        osc.connect(oscGain); osc2.connect(osc2Gain);
        oscGain.connect(filter); osc2Gain.connect(filter); filter.connect(gain);
        if (panner) {
            gain.connect(panner); panner.connect(synthBus);
        } else {
            gain.connect(synthBus);
        }
        
        osc.start(time); osc2.start(time);
        osc.stop(time + duration); osc2.stop(time + duration);
        osc.onended = () => { try { filter.disconnect(); gain.disconnect(); oscGain.disconnect(); osc2Gain.disconnect(); panner?.disconnect(); } catch(e){} };
    }

    function snapToChord(degree) {
        const relativeChordRoot = scale.indexOf((currentChordOffset + 12)%12) !== -1 ? scale.indexOf((currentChordOffset + 12)%12) : 0;
        const validSteps = [0, 1, 3, 5, 6, 8].map(s => s + relativeChordRoot); 
        let closest = degree;
        let minDist = 99;
        for (let v of validSteps) {
            if (Math.abs(v - degree) < minDist) {
                minDist = Math.abs(v - degree);
                closest = v;
            }
        }
        return closest;
    }

    function textSignature(text) {
        let hash = 2166136261;
        for (const character of Array.from(String(text || '').toLowerCase())) {
            hash ^= character.charCodeAt(0);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    function textDegrees(text, startDegree = 4) {
        const letters = Array.from(String(text || '').toLowerCase())
            .map(character => ALPHABET.indexOf(character))
            .filter(index => index >= 0);
        if (!letters.length) return [clamp(Math.round(startDegree), 0, 9)];

        let degree = clamp(Math.round(startDegree), 0, 9);
        let previous = letters[0];
        return letters.map((index, position) => {
            if (position) {
                const difference = index - previous;
                let step = clamp(Math.round(difference / 5), -2, 2);
                if (!step && difference) step = difference > 0 ? 1 : -1;
                degree = clamp(degree + step, 0, 9);
            }
            previous = index;
            return degree;
        });
    }

    function sampleContour(contour, count) {
        if (count <= 1) return [contour[contour.length - 1] ?? 4];
        return Array.from({ length: count }, (_, index) => {
            const sourceIndex = Math.round(index * (contour.length - 1) / (count - 1));
            return contour[sourceIndex] ?? contour[contour.length - 1] ?? 4;
        });
    }

    function buildCommitSolo(kind = 'paragraph', blockProfile = {}) {
        const text = String(blockProfile.text || '');
        const heading = kind === 'heading';
        const words = Math.max(0, Number(blockProfile.words) || text.trim().split(/\s+/).filter(Boolean).length);
        const similarity = clamp(
            Number.isFinite(Number(blockProfile.similarityToPrevious))
                ? Number(blockProfile.similarityToPrevious)
                : contextStats.cohesion * .62 + contextStats.connectedness * .38,
            0,
            1
        );
        const localVowelRatio = clamp(Number(blockProfile.vowelRatio) || contextStats.vowelRatio, .2, .65);
        const identitySignature = mixSeeds(
            textSignature(text),
            textSignature(blockProfile.id || ''),
            documentSeed,
            Math.imul(heading ? 31 : 17, Math.max(1, Number(blockProfile.level) || 1))
        );
        const signature = mixSeeds(
            identitySignature,
            contentSeed,
            sessionSeed,
            Math.imul(commitSequence, 0x9E3779B1)
        );
        const soloRandom = mulberry32(signature);
        const letterCount = Array.from(text.toLowerCase()).filter(character => ALPHABET.includes(character)).length;
        const micro = !heading && (words <= 2 || letterCount < 10);
        const noteCount = heading
            ? clamp(3 + Math.max(1, Number(blockProfile.level) || 1), 4, 5)
            : micro ? 3 : words <= 8 ? 5 : clamp(6 + Math.floor(words / 28), 6, 10);
        const sourceContour = textDegrees(text, currentMelDegree);
        const sampled = sampleContour(sourceContour, noteCount);
        const memory = melodyBuffer.length ? sampleContour(melodyBuffer, noteCount) : sampled;
        const inheritance = .18 + similarity * .34;
        const degrees = sampled.map((degree, index) => {
            const inheritedDegree = Math.round(degree * (1 - inheritance) + memory[index] * inheritance);
            const innerNote = index > 0 && index < sampled.length - 1;
            const mutation = innerNote && soloRandom() < .34
                ? (soloRandom() < .5 ? -1 : 1)
                : 0;
            return clamp(inheritedDegree + mutation, 0, 9);
        });

        const ending = text.trim().slice(-1);
        const cadence = heading
            ? 'section'
            : ending === '?' ? 'question' : ending === '!' ? 'exclamation' : 'resolution';
        if (heading) {
            degrees[degrees.length - 1] = clamp(degrees[0] + 4, 0, 9);
        } else if (ending === '?') {
            degrees[degrees.length - 1] = clamp(degrees[degrees.length - 2] + 2, 0, 9);
        } else if (ending === '!') {
            degrees[degrees.length - 1] = degrees[degrees.length - 2];
        } else {
            degrees[degrees.length - 1] = snapToChord(degrees[degrees.length - 1]);
        }

        const rhythmFamilies = [
            [0, 2, 4, 7, 8, 10, 12, 14, 16, 18],
            [0, 1, 4, 6, 8, 11, 12, 15, 17, 20],
            [0, 3, 4, 7, 9, 10, 13, 16, 18, 21],
            [0, 2, 5, 6, 9, 12, 13, 15, 18, 20]
        ];
        const rhythm = rhythmFamilies[signature % rhythmFamilies.length];
        const steps = rhythm.slice(0, noteCount);
        const velocities = degrees.map((degree, index) => clamp(
            .5 + ((signature >>> (index % 16)) & 3) * .07 + localVowelRatio * .18 + (degree / 9) * .07 + soloRandom() * .04,
            .5,
            .94
        ));
        const durations = steps.map((step, index) => {
            const nextStep = steps[index + 1] ?? step + (heading ? 4 : 3);
            return clamp((nextStep - step) * SIXTEENTH_DUR * .72, .12, heading ? .46 : .34);
        });
        const timbres = degrees.map(() => Math.floor(soloRandom() * 3));
        const pans = degrees.map((degree, index) => clamp(
            (index - (degrees.length - 1) / 2) / Math.max(4, degrees.length) + (soloRandom() - .5) * .16,
            -.34,
            .34
        ));

        return {
            kind: heading ? 'heading' : 'paragraph',
            role: heading ? 'theme-sting' : micro ? 'microfill' : 'paragraph-solo',
            cadence,
            signature,
            identitySignature,
            sessionSeed,
            documentSeed,
            contentSeed,
            variationGeneration: commitSequence,
            similarity,
            vowelRatio: localVowelRatio,
            degrees,
            steps,
            velocities,
            durations,
            timbres,
            pans,
            intensity: micro ? .68 : 1,
            durationSeconds: steps[steps.length - 1] * SIXTEENTH_DUR + durations[durations.length - 1]
        };
    }

    function commit(kind = 'paragraph', blockProfile = {}) {
        if (!ctx || !synthBus) return null;
        if (!String(blockProfile.text || '').trim()) return null;
        commitSequence += 1;
        const solo = buildCommitSolo(kind, blockProfile);
        const punctuationFillOverlap = fillScheduledForNextBar && kind !== 'heading';
        const leadSteps = punctuationFillOverlap ? 2 : 0;
        const compressed = sampleContour(solo.degrees, 8);
        M_pending = compressed;
        melodyBuffer = solo.degrees.slice(-8);
        currentMelDegree = solo.degrees[solo.degrees.length - 1];
        const response = {
            ...solo,
            degrees: [...solo.degrees],
            steps: [...solo.steps],
            velocities: [...solo.velocities],
            durations: [...solo.durations],
            timbres: [...solo.timbres],
            pans: [...solo.pans],
            startsOnGrid: true,
            delayedForSentenceFill: punctuationFillOverlap,
            maxConcurrentPlans: MAX_COMMIT_SOLO_PLANS
        };
        lastBlockResponse = response;
        if (kind === 'heading') {
            headingStingCount += 1;
        } else {
            paragraphSoloCount += 1;
            lastParagraphSolo = response;
        }

        const queuedSolo = {
            plan: response,
            scheduledSteps: solo.steps.map(step => step + leadSteps),
            noteIndex: 0,
            position: 0
        };
        const pendingLimit = Math.max(0, MAX_COMMIT_SOLO_PLANS - (activeCommitSolo ? 1 : 0));
        if (pendingCommitSolos.length >= pendingLimit) {
            if (pendingCommitSolos.length) {
                pendingCommitSolos[pendingCommitSolos.length - 1] = queuedSolo;
            }
            supersededCommitSolos += 1;
        } else {
            pendingCommitSolos.push(queuedSolo);
        }
        return response;
    }

    function scheduleCommitSoloStep(time) {
        if (!activeCommitSolo && pendingCommitSolos.length) {
            activeCommitSolo = pendingCommitSolos.shift();
        }
        const active = activeCommitSolo;
        if (!active) return;

        const { plan, scheduledSteps } = active;
        if (active.position === scheduledSteps[0] && plan.kind === 'heading') {
            playBass(time, true, .22);
        }
        while (
            active.noteIndex < scheduledSteps.length &&
            scheduledSteps[active.noteIndex] === active.position
        ) {
            const noteIndex = active.noteIndex;
            const accent = noteIndex === 0 || noteIndex === plan.degrees.length - 1 ? 1.08 : 1;
            playPluck(
                time,
                plan.degrees[noteIndex] + (
                    plan.kind === 'heading' && noteIndex >= plan.degrees.length - 2 ? 5 : 0
                ),
                plan.velocities[noteIndex],
                plan.durations[noteIndex],
                (.56 + effectDepth * .22) * accent * plan.intensity,
                {
                    timbre: plan.timbres[noteIndex],
                    pan: plan.pans[noteIndex],
                    brightness: .9 + plan.velocities[noteIndex] * .22,
                    detune: 5 + plan.timbres[noteIndex] * 2
                }
            );
            active.noteIndex += 1;
        }
        active.position += 1;
        if (
            active.noteIndex >= scheduledSteps.length &&
            active.position > scheduledSteps[scheduledSteps.length - 1]
        ) {
            activeCommitSolo = null;
        }
    }

    // --- Sequencer ---

    function scheduleStep(step, time) {
        if (!ctx) return;
        scheduleCommitSoloStep(time);
        
        if (step === 0) {
            const stats = getStats();
            const growthBand = Math.floor((stats.words ?? stats.wordCount ?? 0) / 24);
            const phraseNumber = Math.floor(barNumber / 4);
            if (barNumber % 4 === 0) {
                const identityRandom = mulberry32(mixSeeds(
                    documentSeed,
                    contentSeed,
                    growthBand,
                    phraseNumber
                ));
                const sessionRandom = mulberry32(mixSeeds(sessionSeed, phraseNumber, 0x50455246));
                currentGrooveFamily = Math.floor(identityRandom() * GROOVE_PATTERNS.length);
                const baseTexture = Math.floor(identityRandom() * 6);
                currentTextureFamily = (baseTexture + Math.floor(sessionRandom() * 3) - 1 + 6) % 6;
                currentSwing = .535 + sessionRandom() * .04;
                morphAtmosphere(3.2);
            }
            prng = mulberry32(mixSeeds(sessionSeed, documentSeed, contentSeed, phraseNumber, barNumber));

            const darkProgression = [0, -4, 3, -2];
            const openProgression = [0, -2, -4, -5];
            const vowelBlend = clamp((stats.vowelRatio - .35) / .15, 0, 1);
            currentChordOffset = Math.round(
                darkProgression[barNumber % 4] * (1 - vowelBlend) +
                openProgression[barNumber % 4] * vowelBlend
            );
            
            // Företrädesregel B3: synka inte fb om delay bloom är aktivt
            if (delayFB_L && delayFB_R && barNumber >= delayBloomUntilBar) {
                const fb = 0.25 + (typeHeat * 0.20);
                delayFB_L.gain.setTargetAtTime(fb, time, 0.5);
                delayFB_R.gain.setTargetAtTime(fb, time, 0.5);
            }
            
            if (M_pending) {
                M = M_pending;
                M_pending = null;
            }
            
            if (isFillBar) {
                activeFillVariant = pendingFillVariant;
                pendingFillVariant = 'normal';
            }
        }
        
        const effectiveHeat = (isOutro || isFillBar) ? Math.max(0, typeHeat - 0.5) : typeHeat;
        const concentrationGuard = sustainedGestureCount > 180;
        const groove = GROOVE_PATTERNS[currentGrooveFamily] || GROOVE_PATTERNS[0];
        
        // Layer 0: Bass
        if (groove.bass.includes(step)) {
            if (step === 0 || step === 8 || effectiveHeat > 0.1) playBass(time, false);
            if (effectiveHeat > 0.95 && groove.warmBass.includes(step)) playBass(time, true);
        }
        
        // Layer 1: Kick
        // Spela alltid baskagge på slag 1 och 3 (step 0 och 8) för hjärtslag, fyll i slag 2 och 4 när heat ökar
        if (step === 0 || step === 8 || (effectiveHeat > 0.25 && groove.extraKick.includes(step))) {
            playKick(time);
        }
        
        // Layer 2: Hats
        // Spela alltid hi-hat på 2 och 10 (offbeat) svagt, fyll i mer vid mer heat
        if (groove.hats.includes(step) || (effectiveHeat > 0.2 && groove.warmHats.includes(step))) {
            const isOpen = (effectiveHeat > 0.95 && step === groove.warmHats.at(-1));
            const pan = step % 4 === 2 ? -0.3 : 0.3;
            const volMod = effectiveHeat < 0.2 ? 0.3 : 1.0;
            playHat(time, pan, isOpen, volMod);
        }

        // Layer 2b: Ostinato (Sentence Memory)
        // Spela ostinatot svagt i bakgrunden även när man pausar
        if (groove.ostinato.includes(step)) {
            const memoryIndex = Math.floor(step / 2) % M.length;
            let od = Math.round(M[memoryIndex]);
            if (step % 4 === 0) od = snapToChord(od);
            const ostinatoVol = Math.max(0.15, effectiveHeat * 0.5);
            playPluck(time, od, ostinatoVol, 0.12, 0.5, {
                timbre: currentTextureFamily % 3,
                pan: (memoryIndex - 3.5) * .035,
                brightness: .82 + (currentTextureFamily % 3) * .08,
                detune: 4 + currentTextureFamily
            }); // background layer
        }
        
        // Layer 3: Snare & extra hats
        if (effectiveHeat > 0.6) {
            if (step === 4 || step === 12) playSnare(time);
            if (step % 2 !== 0 && prng() < (concentrationGuard ? .16 : .4) && step !== 14) playHat(time, 0, false, 0.8);
        }
        
        // Fill logic (B4)
        if (isFillBar) {
            if (step < 8 && step % 2 === 0) {
                let note = melodyBuffer[step/2 % melodyBuffer.length] || 4;
                if (activeFillVariant === 'question' && step === 6) note = 3;
                playPluck(time, note + 7, fillGain, 0.2);
            }
            if (activeFillVariant === 'question') {
                if (step === 8) playRiser(time, SIXTEENTH_DUR * 8, 0.04);
                if (step === 14) playHat(time, 0, true);
            } else {
                if (step === 0 && !activeCommitSolo && !concentrationGuard) playCrash(time, activeFillVariant === 'exclaim' ? 1.15 : .9);
                if (activeFillVariant === 'exclaim' && !activeCommitSolo && !concentrationGuard && (step === 0 || step === 8)) playStab(time);
            }
        }
        
        if (step === 0 && window.VisualsEngine) window.VisualsEngine.spawnHardForkBlock('space', 0);
    }

    function schedule() {
        if (!beatActive && !activeCommitSolo && !pendingCommitSolos.length) return;
        if (!ctx) return;
        
        if (ctx.state === 'suspended') ctx.resume();
        
        const now = ctx.currentTime;
        if (nextNoteTime < now) nextNoteTime = now + 0.05;
        
        while (nextNoteTime < now + LOOKAHEAD) {
            scheduleStep(step16, nextNoteTime);
            
            const swingRatio = currentSwing + (0.50 - currentSwing) * clamp(typeHeat, 0, 1);
            const isOdd = (step16 % 2 === 1);
            const stepDur = SIXTEENTH_DUR * 2 * (isOdd ? (1 - swingRatio) : swingRatio);
            
            nextNoteTime += stepDur;
            step16++;
            if (step16 >= 16) {
                step16 = 0;
                barNumber++;
                
                if (fillScheduledForNextBar) {
                    isFillBar = true;
                    fillScheduledForNextBar = false;
                } else if (isFillBar) {
                    isFillBar = false;
                }
                
            }
        }
    }

    // --- Input Handling ---

    function handleChar(key, stats) {
        if (!ctx) init();
        if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume();
        if (stats) setContext(stats);
        if (key === 'Backspace' || key === 'Delete') key = '\b';
        if (key === 'Enter') key = '\n';

        const now = ctx.currentTime;
        if (timerResting) {
            typeHeat = Math.max(typeHeat, heatBeforeTimerRest, .55);
            heatBeforeTimerRest = 0;
            timerResting = false;
        }
        const resumedFromPause = beatActive && !isTyping;
        if (resumedFromPause) sustainedGestureCount = 0;
        if (isTyping && lastKeyTime > 0) {
            const keyGap = now - lastKeyTime;
            if (keyGap <= TYPING_PAUSE_THRESHOLD) {
                typeHeat = Math.max(0, typeHeat - keyGap * 0.5);
            }
        }
        
        const lowKey = key.toLowerCase();
        gestureSequence += 1;
        sustainedGestureCount += 1;
        const gestureRandom = mulberry32(mixSeeds(
            sessionSeed,
            documentSeed,
            contentSeed,
            gestureSequence,
            textSignature(key)
        ));
        const gestureCharacter = {
            timbre: Math.floor(gestureRandom() * 3),
            pan: (gestureRandom() - .5) * .28,
            brightness: .88 + gestureRandom() * .25,
            detune: 4 + gestureRandom() * 7
        };
        wakeAtmosphere();
        
        if (!beatActive) {
            beatActive = true;
            isTyping = true;
            isOutro = false;
            nextNoteTime = Math.ceil((ctx.currentTime + 0.02) / SIXTEENTH_DUR) * SIXTEENTH_DUR;
            step16 = 0;
            playBass(ctx.currentTime, false, 0.1);
        } else if (!isTyping) {
            // Återuppta skrivresponsen utan att nollställa rytmfasen eller lägga
            // ett extra basslag ovanpå den redan löpande takten.
            isTyping = true;
            isOutro = false;
        }
        
        lastKeyTime = ctx.currentTime;
        const quantTime = nextNoteTime;
        
        if (key === '\b' || key === 'Delete') {
            playPluck(now, Math.max(0, currentMelDegree - 2), 0.32, 0.08, 0.34, gestureCharacter);
            if (now - lastGlitchTime > 0.4) {
                lastGlitchTime = now;
                const r = gestureRandom();
                if (r > 0.7) {
                    playGlitch(quantTime, 0.15); // Lägre volym
                } else if (r > 0.3) {
                    // Soft noise sweep istället för riser
                    playRiser(quantTime, 0.05, 0.03); 
                } else {
                    // Dovt "kluck"
                    playPluck(quantTime, 0, 0.2, 0.05, 0.2, gestureCharacter);
                }
            }
        } else if (key === '\n') {
            playPluck(now, 0, 0.42, 0.1, 0.42, gestureCharacter);
            typeHeat = Math.min(1.2, typeHeat + 0.1);
            currentSentenceLen++;
            
            const s = getStats();
            const verseSteps = [0, 7, -5, 2, -3, 4, 9, 5, -2, -7];
            currentKeyShift = verseSteps[(s.headings || 0) % verseSteps.length];
            
            if (masterFilter) {
                masterFilter.frequency.cancelScheduledValues(now);
                masterFilter.frequency.setValueAtTime(18000, now);
                masterFilter.frequency.exponentialRampToValueAtTime(300, now + SIXTEENTH_DUR * 4);
                masterFilter.frequency.exponentialRampToValueAtTime(18000, now + SIXTEENTH_DUR * 16);
                sweepUntilTime = now + SIXTEENTH_DUR * 16;
            }
        } else if (key === '#') {
            playPluck(now, currentMelDegree + 5, 0.45, 0.09, 0.46, gestureCharacter);
            typeHeat = Math.min(1.2, typeHeat + 0.1);
            currentSentenceLen++;
            const s = getStats();
            if (s.headings > lastHeadingCount) {
                lastHeadingCount = s.headings;
                const level = s.lastHeadingLevel || 1;
                
                if (level === 1) {
                    // Boot-up sweep stort (H1)
                    if (masterFilter) {
                        masterFilter.frequency.cancelScheduledValues(now);
                        masterFilter.frequency.setValueAtTime(200, now);
                        masterFilter.frequency.exponentialRampToValueAtTime(18000, now + SIXTEENTH_DUR * 8);
                        sweepUntilTime = now + SIXTEENTH_DUR * 8;
                    }
                    playBass(now, true, 0.4); 
                } else if (level === 2) {
                    // Snärtigare sweep (H2)
                    if (masterFilter) {
                        masterFilter.frequency.cancelScheduledValues(now);
                        masterFilter.frequency.setValueAtTime(1000, now);
                        masterFilter.frequency.exponentialRampToValueAtTime(12000, now + SIXTEENTH_DUR * 4);
                        sweepUntilTime = now + SIXTEENTH_DUR * 4;
                    }
                    playBass(now, true, 0.2); 
                } else {
                    // H3+ (subtilt färgskifte)
                    playPluck(now, currentMelDegree - 12, 0.5, 0.05, 0.8, gestureCharacter);
                }
                
                const harmonicShiftCount = s.harmonicShiftCount || 0;
                currentKeyShift = [0, 7, -5, 2, -3, 4, 9, 5, -2, -7][harmonicShiftCount % 10];
            }
            if (window.VisualsEngine) window.VisualsEngine.spawnHardForkBlock('char', 14);
        } else if (key === ' ') {
            playPluck(now, 0, 0.34, 0.075, 0.32, gestureCharacter);
            typeHeat = Math.min(1.2, typeHeat + 0.1);
            currentSentenceLen++;
            addTrace(40, now);
            if (window.VisualsEngine) window.VisualsEngine.spawnHardForkBlock('space', 0);
        } else if (/[.,;:!?]/.test(key)) {
            playPluck(now, currentMelDegree + (key === '?' ? 2 : 0), 0.4, 0.085, 0.4, gestureCharacter);
            typeHeat = Math.min(1.2, typeHeat + 0.1);
            currentSentenceLen++;
            addTrace(90, now);
            if (window.VisualsEngine) window.VisualsEngine.spawnHardForkBlock('punct', 0);
            
            if (key === ',') {
                if (masterFilter && now > sweepUntilTime) {
                    masterFilter.frequency.cancelScheduledValues(now);
                    masterFilter.frequency.setValueAtTime(18000, now);
                    masterFilter.frequency.exponentialRampToValueAtTime(3000, now + SIXTEENTH_DUR * 2);
                    masterFilter.frequency.exponentialRampToValueAtTime(18000, now + SIXTEENTH_DUR * 4);
                }
            } else if (key === ';' || key === ':') {
                playRiser(quantTime, SIXTEENTH_DUR * 4, 0.03);
            } else {
                if (currentSentenceLen >= 2) {
                    fillScheduledForNextBar = true;
                    fillGain = clamp(currentSentenceLen / 120, 0.4, 1.0);
                    pendingFillVariant = (key === '?') ? 'question' : (key === '!') ? 'exclaim' : 'normal';
                    delayBloomUntilBar = barNumber + 2;
                    if (delayFB_L && delayFB_R) {
                        delayFB_L.gain.setTargetAtTime(0.5, now, 0.4);
                        delayFB_R.gain.setTargetAtTime(0.5, now, 0.4);
                    }
                    if (onSentenceCallback) onSentenceCallback({ length: currentSentenceLen });
                    
                    if (sentenceMelody.length >= 2) {
                        const S = [];
                        for (let i = 0; i < 8; i++) {
                            S.push(sentenceMelody[Math.floor(i * sentenceMelody.length / 8) % sentenceMelody.length]);
                        }
                        const w = 0.2 + 0.3 * getStats().g;
                        M_pending = M.map((m, i) => clamp(w * S[i] + (1 - w) * m, 0, 9));
                    }
                }
                currentSentenceLen = 0;
                lastCharIndex = -1;
                sentenceMelody = [];
            }
        } else if (ALPHABET.includes(lowKey)) {
            typeHeat = Math.min(1.2, typeHeat + 0.1);
            currentSentenceLen++;
            const idx = ALPHABET.indexOf(lowKey);
            const diff = lastCharIndex === -1 ? 0 : idx - lastCharIndex;
            lastCharIndex = idx;
            
            let steg = clamp(Math.round(diff / 5), -2, 2);
            if (steg === 0 && diff !== 0) steg = diff > 0 ? 1 : -1;
            
            currentMelDegree = clamp(currentMelDegree + steg, 0, 9);
            
            if (step16 % 4 === 0) {
                currentMelDegree = snapToChord(currentMelDegree);
            }
            
            let octaveOffset = 0;
            if ((step16 === 6 || step16 === 14) && prng() < typeHeat * (sustainedGestureCount > 180 ? .16 : .5)) octaveOffset = 12; // A2
            
            // Direktansatsen tar bort upplevd tangentfördröjning. Det starkare
            // huvudplucket ligger kvar på sextondelsnätet och bevarar groovet.
            playPluck(now, currentMelDegree + octaveOffset/12*5, .35 + gestureRandom() * .08, .068 + gestureRandom() * .018, 0.4, gestureCharacter);
            playPluck(quantTime, currentMelDegree + octaveOffset/12*5, .9 + gestureRandom() * .1, .3, 1, {
                ...gestureCharacter,
                pan: -gestureCharacter.pan * .72,
                timbre: (gestureCharacter.timbre + currentTextureFamily) % 3
            });
            
            if (typeHeat > 0.5 && sustainedGestureCount <= 180) {
                playPluck(quantTime + SIXTEENTH_DUR, currentMelDegree + 1, 0.4, 0.15, 0.6, {
                    ...gestureCharacter,
                    pan: gestureCharacter.pan * .5
                });
            }
            
            melodyBuffer.push(currentMelDegree);
            if (melodyBuffer.length > 8) melodyBuffer.shift();
            
            sentenceMelody.push(currentMelDegree);
            if (sentenceMelody.length > 64) sentenceMelody.shift();
            
            addTrace(degreeToMidi(currentMelDegree, 48 + currentKeyShift + octaveOffset), now);
            activeAckordDegrees = [currentMelDegree]; 
            if (window.VisualsEngine) window.VisualsEngine.spawnHardForkBlock('letter', currentMelDegree);
        }
    }

    function handleKey(e) {
        if (e && e.key) handleChar(e.key);
    }

    function addTrace(midiNum, time) {
        traces.push({ m: midiNum, born: time * 1000 });
        if (traces.length > 50) traces.shift();
    }

    function getState() {
        return {
            traces: [...traces],
            activeAckordDegrees: [...activeAckordDegrees],
            paragraphSoloCount,
            headingStingCount,
            pendingCommitSoloCount: pendingCommitSolos.length,
            commitSoloActive: Boolean(activeCommitSolo),
            supersededCommitSolos,
            maxCommitSoloPlans: MAX_COMMIT_SOLO_PLANS,
            sessionSeed,
            documentSeed,
            contentSeed,
            variationGeneration: commitSequence,
            grooveFamily: currentGrooveFamily,
            textureFamily: currentTextureFamily,
            concentrationGuardActive: sustainedGestureCount > 180,
            beatActive,
            isTyping,
            typeHeat,
            timerResting,
            heatBeforeTimerRest,
            step16,
            nextNoteTime,
            atmosphereSourceCount: atmosphereOscillators.length + Number(Boolean(atmosphereNoise)) + Number(Boolean(atmosphereLfo)),
            lastBlockResponse: lastBlockResponse ? {
                ...lastBlockResponse,
                degrees: [...lastBlockResponse.degrees],
                steps: [...lastBlockResponse.steps],
                velocities: [...lastBlockResponse.velocities],
                durations: [...lastBlockResponse.durations],
                timbres: [...lastBlockResponse.timbres],
                pans: [...lastBlockResponse.pans]
            } : null,
            lastParagraphSolo: lastParagraphSolo ? {
                ...lastParagraphSolo,
                degrees: [...lastParagraphSolo.degrees],
                steps: [...lastParagraphSolo.steps],
                velocities: [...lastParagraphSolo.velocities],
                durations: [...lastParagraphSolo.durations],
                timbres: [...lastParagraphSolo.timbres],
                pans: [...lastParagraphSolo.pans]
            } : null
        };
    }

    let onSentenceCallback = null;
    function onSentence(cb) { onSentenceCallback = cb; }

    return {
        init,
        setVolume,
        setDepth,
        setTimerState,
        setContext,
        commit,
        destroy,
        handleKey,
        handleChar,
        getState,
        onSentence,
        resetMemory
    };
})();
