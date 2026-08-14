/**
 * NebulapulsEngine
 *
 * Ett originellt generativt skrivtema byggt av breda analoga klangfält,
 * lekfulla stegsekvenser och långsamma harmoniska förvandlingar. Motorn
 * använder en stabil dokumentidentitet men varierar framförandet per session.
 */
window.NebulapulsEngine = (() => {
    const ALPHABET = 'abcdefghijklmnopqrstuvwxyzåäö';
    const BPM_FAMILIES = [96, 108, 120, 132];
    const MAX_RESPONSE_PLANS = 2;
    const HARMONIC_WORLDS = [
        { name: 'lydisk', scale: [0, 2, 4, 6, 7, 9, 11], chords: [0, 4, 1, 5] },
        { name: 'dorisk', scale: [0, 2, 3, 5, 7, 9, 10], chords: [0, 3, 5, 2] },
        { name: 'öppen', scale: [0, 2, 5, 7, 9], chords: [0, 3, 1, 4] },
        { name: 'mollglans', scale: [0, 3, 5, 7, 10, 12, 14], chords: [0, 4, 2, 5] }
    ];
    const SEQUENCE_FAMILIES = [
        [0, 2, 4, 2, 5, 2, 4, 1, 0, 3, 5, 3, 6, 4, 2, 1],
        [0, 3, 1, 4, 2, 5, 3, 6, 4, 2, 5, 1, 3, 0, 4, 2],
        [0, 1, 4, 2, 5, 3, 1, 6, 2, 4, 0, 5, 3, 6, 1, 4],
        [0, 4, 2, 5, 1, 3, 6, 2, 0, 5, 3, 1, 4, 6, 2, 5],
        [0, 2, 5, 1, 4, 6, 3, 1, 5, 2, 6, 4]
    ];
    const RHYTHM_MASKS = [
        [1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1],
        [1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1],
        [1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0],
        [1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1]
    ];
    const TIMBRES = [
        { type: 'square', cutoff: 2300, resonance: 5.2, decay: .13, detune: 7 },
        { type: 'sawtooth', cutoff: 1700, resonance: 7.5, decay: .18, detune: 4 },
        { type: 'triangle', cutoff: 3100, resonance: 3.2, decay: .24, detune: 11 },
        { type: 'sine', cutoff: 4200, resonance: 1.1, decay: .32, detune: 2 }
    ];

    let ctx = null;
    let masterGain = null;
    let synthBus = null;
    let compressor = null;
    let masterFilter = null;
    let delaySend = null;
    let delay = null;
    let delayFeedback = null;
    let delayPan = null;
    let padBus = null;
    let padFilter = null;
    let padOscillators = [];
    let padLevels = [];
    let padLfo = null;
    let padLfoDepth = null;
    let schedulerInterval = null;
    let activityInterval = null;

    let globalVolume = .7;
    let effectDepth = 1;
    let bpm = 108;
    let sixteenth = 60 / bpm / 4;
    let lookahead = .13;
    let nextNoteTime = 0;
    let step16 = 0;
    let barNumber = 0;
    let playing = false;
    let isTyping = false;
    let timerResting = false;
    let lastKeyTime = 0;
    let heat = 0;
    let heatBeforeRest = 0;
    let sessionSeed = 0;
    let documentSeed = 0;
    let contentSeed = 0;
    let gestureSequence = 0;
    let commitSequence = 0;
    let worldIndex = 0;
    let sequenceIndex = 0;
    let rhythmIndex = 0;
    let timbreIndex = 0;
    let rootMidi = 43;
    let chordIndex = 0;
    let evolutionGeneration = 0;
    let lastLetter = -1;
    let currentDegree = 2;
    let phrase = [];
    let pendingResponses = [];
    let activeResponse = null;
    let supersededResponses = 0;
    let lastResponse = null;
    let paragraphResponseCount = 0;
    let headingResponseCount = 0;
    let pairedAccentCount = 0;
    let suppressedAccentCount = 0;
    let accentTimes = [];
    let straightDoubleQuoteOpen = false;
    let straightSingleQuoteOpen = false;
    let contextStats = {
        words: 0,
        characters: 0,
        paragraphs: 0,
        headings: 0,
        headingDepth: 0,
        vowelRatio: .38,
        cohesion: 0,
        connectedness: 0,
        averageSentenceWords: 12,
        documentTitle: ''
    };

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    const midiToFreq = midi => 440 * Math.pow(2, (midi - 69) / 12);

    function mulberry32(seed) {
        return function random() {
            let t = seed += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    function mixSeeds(...values) {
        let hash = 2166136261;
        values.forEach(value => {
            hash ^= Number(value) >>> 0;
            hash = Math.imul(hash, 16777619);
            hash ^= hash >>> 13;
        });
        return hash >>> 0;
    }

    function textSignature(text) {
        let hash = 2166136261;
        for (const character of String(text || '')) {
            hash ^= character.codePointAt(0);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    function createSessionSeed() {
        return mixSeeds(
            Math.floor(Math.random() * 0xFFFFFFFF),
            Date.now(),
            typeof performance !== 'undefined' ? Math.floor(performance.now() * 1000) : 1
        );
    }

    function world() {
        return HARMONIC_WORLDS[worldIndex % HARMONIC_WORLDS.length];
    }

    function degreeToMidi(degree, octaveShift = 0) {
        const scale = world().scale;
        const scaleLength = scale.length;
        const wrapped = ((degree % scaleLength) + scaleLength) % scaleLength;
        const octave = Math.floor(degree / scaleLength);
        return rootMidi + scale[wrapped] + octave * 12 + octaveShift;
    }

    function safeRamp(parameter, value, time, seconds = .12) {
        if (!parameter || !Number.isFinite(value)) return;
        parameter.cancelScheduledValues(time);
        parameter.setValueAtTime(Math.max(.0001, parameter.value || .0001), time);
        parameter.exponentialRampToValueAtTime(Math.max(.0001, value), time + Math.max(.01, seconds));
    }

    function makeCurve(amount = 6) {
        const curve = new Float32Array(4096);
        for (let index = 0; index < curve.length; index += 1) {
            const x = index * 2 / curve.length - 1;
            curve[index] = Math.tanh(x * amount) / Math.tanh(amount);
        }
        return curve;
    }

    function createPad() {
        padBus = ctx.createGain();
        padBus.gain.value = .0001;
        padFilter = ctx.createBiquadFilter();
        padFilter.type = 'lowpass';
        padFilter.frequency.value = 820;
        padFilter.Q.value = 1.4;
        padBus.connect(padFilter);
        padFilter.connect(synthBus);

        const degrees = [0, 2, 4, 7];
        padOscillators = degrees.map((degree, index) => {
            const oscillator = ctx.createOscillator();
            const level = ctx.createGain();
            oscillator.type = index === 0 ? 'triangle' : (index === 3 ? 'sine' : 'sawtooth');
            oscillator.frequency.value = midiToFreq(degreeToMidi(degree, index ? 0 : -12));
            oscillator.detune.value = [-7, 4, -3, 8][index];
            level.gain.value = [.15, .055, .045, .025][index];
            oscillator.connect(level);
            level.connect(padBus);
            oscillator.start();
            padLevels.push(level);
            return oscillator;
        });

        padLfo = ctx.createOscillator();
        padLfo.type = 'sine';
        padLfo.frequency.value = .027;
        padLfoDepth = ctx.createGain();
        padLfoDepth.gain.value = 260;
        padLfo.connect(padLfoDepth);
        padLfoDepth.connect(padFilter.frequency);
        padLfo.start();
        wakePad(2.8);
    }

    function wakePad(seconds = 1.8) {
        if (!padBus || !ctx) return;
        const target = timerResting ? .018 : .055 + Math.min(.028, heat * .02);
        padBus.gain.cancelScheduledValues(ctx.currentTime);
        padBus.gain.setTargetAtTime(target, ctx.currentTime, Math.max(.08, seconds / 3));
    }

    function retunePad(seconds = 2.4) {
        if (!ctx || !padOscillators.length) return;
        const chordDegree = world().chords[chordIndex % world().chords.length];
        [0, 2, 4, 7].forEach((relativeDegree, index) => {
            const target = midiToFreq(degreeToMidi(chordDegree + relativeDegree, index ? 0 : -12));
            padOscillators[index].frequency.cancelScheduledValues(ctx.currentTime);
            padOscillators[index].frequency.setTargetAtTime(target, ctx.currentTime, Math.max(.12, seconds / 3));
        });
        const brightness = 620 + contextStats.vowelRatio * 1050 + heat * 420 + timbreIndex * 90;
        padFilter.frequency.setTargetAtTime(clamp(brightness, 620, 2200), ctx.currentTime, .8);
    }

    function playVoice(time, degree, options = {}) {
        if (!ctx || !synthBus) return;
        const timbre = TIMBRES[options.timbre ?? timbreIndex % TIMBRES.length];
        const duration = clamp(options.duration ?? timbre.decay, .035, 2.8);
        const gainValue = clamp(options.gain ?? .045, .002, .16);
        const frequency = midiToFreq(degreeToMidi(degree, options.octave || 12));
        const oscillator = ctx.createOscillator();
        const companion = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        const panner = ctx.createStereoPanner();
        oscillator.type = timbre.type;
        companion.type = timbre.type === 'square' ? 'triangle' : 'sine';
        oscillator.frequency.setValueAtTime(frequency, time);
        companion.frequency.setValueAtTime(frequency * (options.harmonic || 2), time);
        oscillator.detune.value = timbre.detune;
        companion.detune.value = -timbre.detune * .7;
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(clamp(timbre.cutoff * (options.brightness || 1), 480, 7600), time);
        filter.Q.value = timbre.resonance;
        panner.pan.value = clamp(options.pan || 0, -.82, .82);
        gain.gain.setValueAtTime(.0001, time);
        gain.gain.exponentialRampToValueAtTime(gainValue, time + Math.min(.025, duration * .16));
        gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
        oscillator.connect(filter);
        companion.connect(filter);
        filter.connect(gain);
        gain.connect(panner);
        panner.connect(synthBus);
        panner.connect(delaySend);
        oscillator.start(time);
        companion.start(time);
        oscillator.stop(time + duration + .04);
        companion.stop(time + duration + .04);
    }

    function playBass(time, degree, gain = .045) {
        playVoice(time, degree, {
            octave: -12,
            gain,
            duration: .42,
            timbre: 2,
            brightness: .48,
            pan: 0,
            harmonic: 1
        });
    }

    function playStar(time, degree, strength = 1, pan = 0) {
        playVoice(time, degree, {
            octave: 24,
            gain: .014 * strength,
            duration: .46 + strength * .18,
            timbre: 3,
            brightness: 1.25,
            pan,
            harmonic: 1.5
        });
    }

    function evolve(force = false) {
        if (!force && barNumber % 4 !== 0) return;
        evolutionGeneration += 1;
        const random = mulberry32(mixSeeds(sessionSeed, documentSeed, contentSeed, evolutionGeneration));
        const largeTurn = force || random() > .56;
        if (largeTurn) {
            sequenceIndex = (sequenceIndex + 1 + Math.floor(random() * (SEQUENCE_FAMILIES.length - 1))) % SEQUENCE_FAMILIES.length;
            timbreIndex = (timbreIndex + 1 + Math.floor(random() * 2)) % TIMBRES.length;
        }
        if (force || random() > .68) {
            rhythmIndex = (rhythmIndex + 1 + Math.floor(random() * 2)) % RHYTHM_MASKS.length;
        }
        if (force || (barNumber > 0 && barNumber % 16 === 0)) {
            worldIndex = (worldIndex + 1 + Math.floor(random() * 2)) % HARMONIC_WORLDS.length;
        }
        chordIndex = (chordIndex + 1) % world().chords.length;
        retunePad(force ? 1.6 : 3.2);
    }

    function playScheduledResponse(time, step) {
        if (!activeResponse && pendingResponses.length) activeResponse = pendingResponses.shift();
        if (!activeResponse) return;
        const index = activeResponse.steps.indexOf(activeResponse.position);
        if (index >= 0) {
            playVoice(time, activeResponse.degrees[index], {
                octave: activeResponse.kind === 'heading' ? 24 : 12,
                gain: activeResponse.velocities[index] * .075,
                duration: activeResponse.durations[index],
                timbre: activeResponse.timbres[index],
                pan: activeResponse.pans[index],
                brightness: activeResponse.kind === 'heading' ? 1.28 : 1.05
            });
        }
        activeResponse.position += 1;
        if (activeResponse.position > activeResponse.steps.at(-1) + 2) activeResponse = null;
    }

    function scheduleStep(step, time) {
        const sequence = SEQUENCE_FAMILIES[sequenceIndex];
        const rhythm = RHYTHM_MASKS[rhythmIndex];
        const chordDegree = world().chords[chordIndex % world().chords.length];
        const concentration = contextStats.averageSentenceWords > 22 || contextStats.words > 1800;
        const energy = timerResting ? .12 : clamp(.2 + heat * .68, .18, 1);
        const sparse = concentration && step % 4 !== 0;

        if (rhythm[step] && !sparse && energy > .14) {
            const sequenceDegree = sequence[(barNumber * 16 + step) % sequence.length];
            const octaveLeap = step % 8 === 6 && heat > .62 ? 7 : 0;
            playVoice(time, chordDegree + sequenceDegree + octaveLeap, {
                gain: .018 + energy * .035,
                duration: TIMBRES[timbreIndex].decay * (.8 + energy * .55),
                timbre: timbreIndex,
                pan: ((step % 4) - 1.5) * .18,
                brightness: .72 + energy * .58
            });
        }
        if ((step === 0 || (step === 8 && heat > .48)) && !timerResting) {
            playBass(time, chordDegree, .025 + energy * .035);
        }
        if ((step === 5 || step === 13) && heat > .7 && !concentration && !timerResting) {
            playStar(time, chordDegree + sequence[step % sequence.length], .7 + heat * .22, step === 5 ? -.46 : .46);
        }
        playScheduledResponse(time, step);
    }

    function schedule() {
        if (!ctx || (!playing && !activeResponse && !pendingResponses.length)) return;
        if (ctx.state === 'suspended') ctx.resume();
        const now = ctx.currentTime;
        if (nextNoteTime < now) nextNoteTime = now + .04;
        while (nextNoteTime < now + lookahead) {
            scheduleStep(step16, nextNoteTime);
            const swing = .5 + clamp(.015 + contextStats.connectedness * .035, .015, .05);
            const duration = sixteenth * 2 * (step16 % 2 ? 1 - swing : swing);
            nextNoteTime += duration;
            step16 += 1;
            if (step16 >= 16) {
                step16 = 0;
                barNumber += 1;
                evolve(false);
            }
        }
    }

    function setContext(profile = {}) {
        contextStats = {
            ...contextStats,
            words: Math.max(0, Number(profile.words) || 0),
            characters: Math.max(0, Number(profile.characters) || 0),
            paragraphs: Math.max(0, Number(profile.paragraphs) || 0),
            headings: Math.max(0, Number(profile.headings) || 0),
            headingDepth: clamp(Number(profile.headingDepth) || 0, 0, 6),
            vowelRatio: clamp(Number(profile.vowelRatio) || .38, .2, .65),
            cohesion: clamp(Number(profile.cohesion) || 0, 0, 1),
            connectedness: clamp(Number(profile.connectedness) || 0, 0, 1),
            averageSentenceWords: clamp(Number(profile.averageSentenceWords) || 12, 2, 60),
            documentTitle: String(profile.documentTitle || '')
        };
        const previousSeed = documentSeed;
        documentSeed = mixSeeds(
            textSignature(profile.documentId || ''),
            textSignature(contextStats.documentTitle),
            0x4E454255
        );
        contentSeed = mixSeeds(
            Number(profile.contentFingerprint) || 0,
            contextStats.characters,
            contextStats.paragraphs,
            Math.round(contextStats.vowelRatio * 1000)
        );
        if (documentSeed !== previousSeed && ctx) {
            worldIndex = documentSeed % HARMONIC_WORLDS.length;
            sequenceIndex = (documentSeed >>> 3) % SEQUENCE_FAMILIES.length;
            rhythmIndex = (documentSeed >>> 7) % RHYTHM_MASKS.length;
            rootMidi = 38 + ((documentSeed >>> 11) % 8);
            retunePad(2.4);
        }
    }

    function init(audioContext, destination) {
        ctx = audioContext || ctx || new (window.AudioContext || window.webkitAudioContext)();
        if (masterGain) return;
        sessionSeed = createSessionSeed();
        const random = mulberry32(sessionSeed);
        bpm = BPM_FAMILIES[Math.floor(random() * BPM_FAMILIES.length)];
        sixteenth = 60 / bpm / 4;
        worldIndex = documentSeed % HARMONIC_WORLDS.length;
        sequenceIndex = (documentSeed + Math.floor(random() * 3)) % SEQUENCE_FAMILIES.length;
        rhythmIndex = Math.floor(random() * RHYTHM_MASKS.length);
        timbreIndex = Math.floor(random() * TIMBRES.length);

        masterGain = ctx.createGain();
        masterGain.gain.value = globalVolume;
        synthBus = ctx.createGain();
        synthBus.gain.value = 1;
        masterFilter = ctx.createBiquadFilter();
        masterFilter.type = 'lowpass';
        masterFilter.frequency.value = 11000;
        compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -20;
        compressor.knee.value = 18;
        compressor.ratio.value = 4;
        compressor.attack.value = .008;
        compressor.release.value = .24;
        const shaper = ctx.createWaveShaper();
        shaper.curve = makeCurve(2.4);
        shaper.oversample = '2x';
        delaySend = ctx.createGain();
        delaySend.gain.value = .24;
        delay = ctx.createDelay();
        delay.delayTime.value = sixteenth * 3;
        delayFeedback = ctx.createGain();
        delayFeedback.gain.value = .28;
        delayPan = ctx.createStereoPanner();
        delayPan.pan.value = .62;

        synthBus.connect(masterFilter);
        masterFilter.connect(shaper);
        shaper.connect(compressor);
        compressor.connect(masterGain);
        delaySend.connect(delay);
        delay.connect(delayPan);
        delayPan.connect(masterGain);
        delay.connect(delayFeedback);
        delayFeedback.connect(delay);
        masterGain.connect(destination || ctx.destination);
        createPad();

        playing = true;
        nextNoteTime = ctx.currentTime + .04;
        schedulerInterval = setInterval(schedule, 25);
        activityInterval = setInterval(() => {
            if (!ctx) return;
            if (isTyping && ctx.currentTime - lastKeyTime > .65) isTyping = false;
            heat = Math.max(timerResting ? .05 : .16, heat * (isTyping ? .992 : .965));
        }, 120);
        evolve(true);
    }

    function accentAllowed(structural = false) {
        if (!ctx) return false;
        const now = ctx.currentTime;
        accentTimes = accentTimes.filter(time => now - time < 1.1);
        if (!structural && accentTimes.length >= 4) {
            suppressedAccentCount += 1;
            return false;
        }
        accentTimes.push(now);
        return true;
    }

    function playPairedAccent(key) {
        const pairs = { '(': 0, ')': 0, '[': 2, ']': 2, '{': 4, '}': 4, '“': 1, '”': 1, '‘': 3, '’': 3 };
        let opening = '([{“‘'.includes(key);
        if (key === '"') {
            opening = !straightDoubleQuoteOpen;
            straightDoubleQuoteOpen = opening;
        } else if (key === "'") {
            opening = !straightSingleQuoteOpen;
            straightSingleQuoteOpen = opening;
        } else if (!(key in pairs)) {
            return false;
        }
        if (!accentAllowed(false)) return true;
        pairedAccentCount += 1;
        const degree = pairs[key] ?? (key === '"' ? 1 : 3);
        playStar(ctx.currentTime, degree + (opening ? 3 : 0), .72, opening ? -.58 : .58);
        return true;
    }

    function handleChar(key, stats) {
        if (!ctx) init();
        if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume();
        if (stats) setContext(stats);
        if (key === 'Backspace' || key === 'Delete') key = '\b';
        if (key === 'Enter') key = '\n';
        const lower = String(key).toLowerCase();
        const index = ALPHABET.indexOf(lower);
        gestureSequence += 1;
        isTyping = true;
        playing = true;
        timerResting = false;
        lastKeyTime = ctx.currentTime;
        heat = clamp(heat + .075, .18, 1.12);
        wakePad(.8);
        if (nextNoteTime < ctx.currentTime) nextNoteTime = ctx.currentTime + .025;

        if (playPairedAccent(key)) return;
        if (index >= 0) {
            const difference = lastLetter < 0 ? 0 : index - lastLetter;
            lastLetter = index;
            let movement = clamp(Math.round(difference / 5), -3, 3);
            if (!movement && difference) movement = difference > 0 ? 1 : -1;
            currentDegree = clamp(currentDegree + movement, -2, 12);
            phrase.push(currentDegree);
            if (phrase.length > 32) phrase.shift();
            const vowel = 'aeiouyåäö'.includes(lower);
            const random = mulberry32(mixSeeds(sessionSeed, documentSeed, gestureSequence, index));
            playVoice(ctx.currentTime, currentDegree, {
                gain: vowel ? .025 : .018,
                duration: vowel ? .15 + random() * .08 : .065 + random() * .04,
                timbre: (timbreIndex + Math.floor(random() * 2)) % TIMBRES.length,
                pan: (index - 14) / 30,
                brightness: vowel ? 1.08 : .85,
                harmonic: vowel ? 1.5 : 2
            });
            return;
        }
        if (key === ' ') {
            playVoice(ctx.currentTime, world().chords[chordIndex], { octave: 0, gain: .014, duration: .09, timbre: 3 });
            return;
        }
        if (key === '\b') {
            phrase.pop();
            currentDegree = Math.max(-2, currentDegree - 1);
            playVoice(ctx.currentTime, currentDegree, { gain: .016, duration: .07, timbre: 2, pan: -.32, brightness: .55 });
            return;
        }
        if (key === '\n') {
            if (accentAllowed(false)) playVoice(ctx.currentTime, currentDegree - 2, { octave: 0, gain: .022, duration: .35, timbre: 3, pan: -.18 });
            lastLetter = -1;
            return;
        }
        if (/[.!?]/.test(key) && accentAllowed(false)) {
            const contour = phrase.slice(-4);
            contour.forEach((degree, noteIndex) => playStar(
                ctx.currentTime + noteIndex * .065,
                degree + (key === '?' ? noteIndex : key === '!' ? 4 : -noteIndex),
                key === '!' ? 1 : .68,
                -.42 + noteIndex * .28
            ));
            phrase = [];
            lastLetter = -1;
        }
    }

    function sampleTextContour(text, count) {
        const letters = Array.from(String(text || '').toLowerCase()).filter(character => ALPHABET.includes(character));
        if (!letters.length) return [];
        const result = [];
        for (let index = 0; index < count; index += 1) {
            const letter = letters[Math.min(letters.length - 1, Math.floor(index * letters.length / count))];
            result.push(Math.round(ALPHABET.indexOf(letter) / 4));
        }
        return result;
    }

    function commit(kind = 'paragraph', blockProfile = {}) {
        if (!ctx || !synthBus) return null;
        const text = String(blockProfile.text || '').trim();
        if (!text) return null;
        commitSequence += 1;
        const heading = kind === 'heading';
        const signature = mixSeeds(textSignature(text), documentSeed, contentSeed);
        const random = mulberry32(mixSeeds(signature, sessionSeed, commitSequence));
        const noteCount = heading ? 7 : clamp(3 + Math.floor(Math.log2(text.length + 1)), 3, 9);
        const contour = sampleTextContour(text, noteCount);
        const base = world().chords[(chordIndex + (heading ? 1 : 0)) % world().chords.length];
        const degrees = contour.map((degree, index) => clamp(base + degree + (random() > .72 ? (random() > .5 ? 1 : -1) : 0), -2, 14));
        const ending = text.slice(-1);
        if (ending === '?') degrees[degrees.length - 1] += 2;
        else if (ending === '!') degrees[degrees.length - 1] += 4;
        else degrees[degrees.length - 1] = base;
        const rhythmFamilies = [
            [0, 2, 4, 7, 9, 12, 14, 17, 20],
            [0, 1, 4, 6, 8, 11, 13, 16, 19],
            [0, 3, 5, 6, 10, 12, 15, 17, 21]
        ];
        const steps = rhythmFamilies[signature % rhythmFamilies.length].slice(0, noteCount);
        const plan = {
            kind: heading ? 'heading' : 'paragraph',
            role: heading ? 'harmonic-portal' : text.length < 18 ? 'micro-orbit' : 'text-constellation',
            signature,
            sessionSeed,
            variationGeneration: commitSequence,
            harmonicWorld: world().name,
            degrees,
            steps,
            velocities: degrees.map(() => .52 + random() * .34),
            durations: degrees.map((degree, index) => clamp(.15 + random() * .26 + (heading && index === degrees.length - 1 ? .5 : 0), .14, .9)),
            timbres: degrees.map(() => Math.floor(random() * TIMBRES.length)),
            pans: degrees.map((degree, index) => clamp((index / Math.max(1, degrees.length - 1) - .5) * 1.1 + (random() - .5) * .14, -.68, .68)),
            position: 0,
            goalMilestone: [25, 50, 75, 100].includes(Number(blockProfile.goalMilestone)) ? Number(blockProfile.goalMilestone) : null
        };
        if (plan.goalMilestone) {
            plan.degrees.push(base + 7);
            plan.steps.push(plan.steps.at(-1) + 3);
            plan.velocities.push(.8);
            plan.durations.push(.7);
            plan.timbres.push(3);
            plan.pans.push(0);
        }
        if (heading) {
            headingResponseCount += 1;
            evolve(true);
        } else {
            paragraphResponseCount += 1;
        }
        lastResponse = { ...plan, degrees: [...plan.degrees], steps: [...plan.steps] };
        const availablePending = Math.max(0, MAX_RESPONSE_PLANS - (activeResponse ? 1 : 0));
        if (pendingResponses.length >= availablePending && pendingResponses.length) {
            pendingResponses[pendingResponses.length - 1] = plan;
            supersededResponses += 1;
        } else if (availablePending > 0) {
            pendingResponses.push(plan);
        } else {
            supersededResponses += 1;
        }
        accentAllowed(true);
        heat = clamp(heat + (heading ? .24 : .12), .18, 1.12);
        playing = true;
        return lastResponse;
    }

    function setVolume(value) {
        globalVolume = clamp(Number(value) || 0, 0, 1.2);
        if (masterGain && ctx) masterGain.gain.setTargetAtTime(globalVolume, ctx.currentTime, .08);
    }

    function setDepth(value) {
        effectDepth = clamp(Number(value) || 0, .35, 1.25);
        if (delaySend && ctx) delaySend.gain.setTargetAtTime(.12 + effectDepth * .16, ctx.currentTime, .12);
        if (padLfoDepth && ctx) padLfoDepth.gain.setTargetAtTime(150 + effectDepth * 135, ctx.currentTime, .3);
    }

    function setTimerState(state, mode = 'focus') {
        if (!ctx) return;
        if (state === 'finished') {
            heatBeforeRest = Math.max(heatBeforeRest, heat, .45);
            timerResting = true;
            heat = .06;
            wakePad(2.2);
            return;
        }
        if (state === 'running' && mode === 'focus') {
            timerResting = false;
            heat = Math.max(heat, heatBeforeRest, .42);
            heatBeforeRest = 0;
            playing = true;
            wakePad(1.1);
            return;
        }
        if (state === 'idle') {
            timerResting = false;
            heatBeforeRest = 0;
        }
    }

    function resetMemory() {
        nextNoteTime = 0;
        step16 = 0;
        barNumber = 0;
        chordIndex = 0;
        evolutionGeneration = 0;
        lastLetter = -1;
        currentDegree = 2;
        phrase = [];
        pendingResponses = [];
        activeResponse = null;
        supersededResponses = 0;
        lastResponse = null;
        paragraphResponseCount = 0;
        headingResponseCount = 0;
        pairedAccentCount = 0;
        suppressedAccentCount = 0;
        accentTimes = [];
        gestureSequence = 0;
        commitSequence = 0;
        heat = 0;
        heatBeforeRest = 0;
        isTyping = false;
        timerResting = false;
        straightDoubleQuoteOpen = false;
        straightSingleQuoteOpen = false;
    }

    function destroy() {
        if (schedulerInterval) clearInterval(schedulerInterval);
        if (activityInterval) clearInterval(activityInterval);
        [...padOscillators, padLfo].filter(Boolean).forEach(source => {
            try { source.stop(); } catch (error) {}
            try { source.disconnect(); } catch (error) {}
        });
        [...padLevels, padLfoDepth, padFilter, padBus].filter(Boolean).forEach(node => {
            try { node.disconnect(); } catch (error) {}
        });
        if (masterGain && ctx) {
            const oldMaster = masterGain;
            oldMaster.gain.setTargetAtTime(0, ctx.currentTime, .06);
            setTimeout(() => { try { oldMaster.disconnect(); } catch (error) {} }, 140);
        }
        schedulerInterval = null;
        activityInterval = null;
        masterGain = null;
        synthBus = null;
        compressor = null;
        masterFilter = null;
        delaySend = null;
        delay = null;
        delayFeedback = null;
        delayPan = null;
        padBus = null;
        padFilter = null;
        padOscillators = [];
        padLevels = [];
        padLfo = null;
        padLfoDepth = null;
        playing = false;
        resetMemory();
        sessionSeed = 0;
        ctx = null;
    }

    function getState() {
        return {
            bpm,
            playing,
            isTyping,
            timerResting,
            heat,
            step16,
            barNumber,
            sessionSeed,
            documentSeed,
            contentSeed,
            harmonicWorld: world().name,
            worldIndex,
            sequenceFamily: sequenceIndex,
            rhythmFamily: rhythmIndex,
            timbreFamily: timbreIndex,
            evolutionGeneration,
            padVoiceCount: padOscillators.length,
            paragraphResponseCount,
            headingResponseCount,
            pendingResponseCount: pendingResponses.length,
            responseActive: Boolean(activeResponse),
            maxResponsePlans: MAX_RESPONSE_PLANS,
            supersededResponses,
            pairedAccentCount,
            suppressedAccentCount,
            lastResponse: lastResponse ? {
                ...lastResponse,
                degrees: [...lastResponse.degrees],
                steps: [...lastResponse.steps],
                velocities: [...lastResponse.velocities],
                durations: [...lastResponse.durations],
                timbres: [...lastResponse.timbres],
                pans: [...lastResponse.pans]
            } : null
        };
    }

    return {
        init,
        setVolume,
        setDepth,
        setTimerState,
        setContext,
        commit,
        destroy,
        handleChar,
        getState,
        resetMemory
    };
})();
