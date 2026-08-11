/**
 * ValsangEngine (BYGGSPEC v6)
 * 
 * En ljudmotor för SkrivR baserad på Web Audio API. 
 * Skapar ett dynamiskt fokusljud där fraser, andning och en fast flock av
 * korsfadande röster formas av dokumentets text och struktur.
 */

window.ValsangEngine = (() => {
    let ctx = null;
    let masterGain, dryGain, wetGain, compressor, convolver;
    let voiceOsc1, voiceOsc2, subOsc, voiceGain;
    let voiceFilter, formantFilter, upperFormantFilter;
    let vibratoLFO, vibratoGain;
    let songLFO, songGain;
    let voices = [];
    let activeVoiceIndex = 0;
    let voiceGeneration = 0;
    let commitCount = 0;
    let responseSongCount = 0;
    let lastResponseSong = null;
    let pendingEnterAccentTimer = null;
    let pendingEnterAccent = false;
    let pendingSentenceAccentTimer = null;
    let pendingSentenceAccent = null;
    let accentTimes = [];
    let pairedAccentCount = 0;
    let composedAccentCount = 0;
    let suppressedAccentCount = 0;
    let lastAccentKind = null;
    let straightDoubleQuoteOpen = false;
    let straightSingleQuoteOpen = false;

    let noiseBuffer = null;
    let irBuffer = null;

    // State
    const ALPHABET = "abcdefghijklmnopqrstuvwxyzåäö";
    const SCALES = {
        moll: [0, 3, 5, 7, 10],   // moll-pentatonisk
        dur: [0, 2, 5, 7, 9]      // dur/sus-pentatonisk
    };
    const CALL_PROFILES = {
        deepMoan: {
            type: 'deep-moan',
            family: 'tonal-moan',
            degreeBias: -2,
            durationScale: 1.08,
            spacingScale: .58,
            startDelay: .52,
            fundamental: .75,
            overtone: .11,
            sub: .14,
            lowpass: 1120,
            formantBias: -90,
            songDepth: 8
        },
        upcall: {
            type: 'upcall',
            family: 'frequency-sweep',
            degreeBias: -1,
            durationScale: .86,
            spacingScale: .64,
            startDelay: .38,
            fundamental: .69,
            overtone: .19,
            sub: .12,
            lowpass: 1480,
            formantBias: 40,
            songDepth: 11
        },
        warble: {
            type: 'warble',
            family: 'modulated-call',
            degreeBias: 0,
            durationScale: .76,
            spacingScale: .55,
            startDelay: .34,
            fundamental: .62,
            overtone: .26,
            sub: .12,
            lowpass: 1760,
            formantBias: 130,
            songDepth: 19
        },
        pulseTrain: {
            type: 'pulse-train',
            family: 'rhythmic-pulse',
            degreeBias: -1,
            durationScale: .58,
            spacingScale: .44,
            startDelay: .28,
            fundamental: .66,
            overtone: .14,
            sub: .20,
            lowpass: 1240,
            formantBias: -30,
            songDepth: 6
        }
    };
    const CALL_REPERTOIRE = [
        CALL_PROFILES.deepMoan,
        CALL_PROFILES.upcall,
        CALL_PROFILES.warble,
        CALL_PROFILES.pulseTrain
    ];
    
    let rootMidi = 43; // G2
    let degreeFloat = 4.0;
    let currentDegree = 4;
    let prevAlphaIdx = null;
    let sentenceBuffer = [];
    let blockBuffer = [];
    
    // Timing and Breathing
    let lastKeyTime = 0;
    let dtEma = 420; // Start at 420 per spec
    
    let idleLFO = null;
    let idleGain = null;
    let idleTimer = null;
    let isIdle = true;
    
    let onTraceCallback = null;
    let isDurScale = false;
    let contextStats = {
        N: 0,
        g: 1,
        meanAlpha: 14,
        vowelRatio: 0.38,
        paragraphs: 0,
        cohesion: 0,
        connectedness: 0,
        averageSentenceWords: 12
    };

    // Helper functions
    const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
    const lerp = (a, b, t) => a + (b - a) * t;
    const midiToFreq = m => 440 * Math.pow(2, (m - 69) / 12);
    
    const getScale = () => isDurScale ? SCALES.dur : SCALES.moll;
    const degreeToMidi = (deg, root) => {
        const octave = Math.floor(deg / 5);
        const scale = getScale();
        // Handle negative degrees correctly by wrapping
        let modDegree = deg % 5;
        if (modDegree < 0) modDegree += 5;
        const note = scale[modDegree];
        return root + 12 * octave + note;
    };

    const createNoiseBuffer = () => {
        const bufferSize = ctx.sampleRate * 2.0;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        return buffer;
    };

    const createImpulseResponse = () => {
        const length = ctx.sampleRate * 3.8;
        const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                const env = Math.pow(1 - (i / length), 3.2);
                channelData[i] = (Math.random() * 2 - 1) * env;
            }
        }
        return impulse;
    };

    function getStats() {
        return contextStats;
    }

    function setContext(profile = {}) {
        const words = Math.max(0, Number(profile.words) || 0);
        const averageWordLength = clamp(Number(profile.averageWordLength) || 5, 2, 12);
        const N = Math.max(0, Number(profile.characters) || words * averageWordLength);
        contextStats = {
            ...contextStats,
            N,
            g: 40 / (40 + N),
            meanAlpha: clamp(Number(profile.meanAlpha) || 14, 0, 28),
            vowelRatio: clamp(Number(profile.vowelRatio) || 0.38, 0.2, 0.65),
            paragraphs: Math.max(0, Number(profile.paragraphs) || 0),
            words,
            headings: Math.max(0, Number(profile.headings) || 0),
            lastHeadingLevel: Math.max(0, Number(profile.headingDepth) || 0),
            harmonicShiftCount: Math.max(0, Number(profile.harmonicShiftCount) || 0),
            connectedness: clamp(Number(profile.connectedness) || 0, 0, 1),
            cohesion: clamp(Number(profile.cohesion) || 0, 0, 1),
            averageSentenceWords: clamp(Number(profile.averageSentenceWords) || 12, 3, 45)
        };
    }

    function createVoice(index) {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const sub = ctx.createOscillator();
        const fundamentalLevel = ctx.createGain();
        const overtoneLevel = ctx.createGain();
        const subLevel = ctx.createGain();
        const gain = ctx.createGain();
        const lowpass = ctx.createBiquadFilter();
        const formant = ctx.createBiquadFilter();
        const upperFormant = ctx.createBiquadFilter();
        const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;

        osc1.type = 'sine';
        osc2.type = 'triangle';
        osc2.detune.value = 5 + index * 1.5;
        sub.type = 'sine';
        fundamentalLevel.gain.value = .62;
        overtoneLevel.gain.value = .22;
        subLevel.gain.value = .16;
        gain.gain.value = 0;

        lowpass.type = 'lowpass';
        lowpass.frequency.value = 1450;
        lowpass.Q.value = .48;
        formant.type = 'peaking';
        formant.frequency.value = 540 + index * 70;
        formant.Q.value = 1.12;
        formant.gain.value = 5.2;
        upperFormant.type = 'peaking';
        upperFormant.frequency.value = 980 + index * 85;
        upperFormant.Q.value = .82;
        upperFormant.gain.value = 2.8;
        if (panner) panner.pan.value = [-.22, .18, .02][index] || 0;

        osc1.connect(fundamentalLevel).connect(gain);
        osc2.connect(overtoneLevel).connect(gain);
        sub.connect(subLevel).connect(gain);
        gain.connect(lowpass).connect(formant).connect(upperFormant);
        const output = panner || upperFormant;
        if (panner) upperFormant.connect(panner);
        output.connect(dryGain);
        output.connect(wetGain);

        vibratoGain.connect(osc1.detune);
        vibratoGain.connect(osc2.detune);
        songGain.connect(osc1.detune);
        songGain.connect(osc2.detune);
        idleGain.connect(osc1.detune);
        idleGain.connect(osc2.detune);

        osc1.start();
        osc2.start();
        sub.start();
        return {
            index,
            osc1,
            osc2,
            sub,
            fundamentalLevel,
            overtoneLevel,
            subLevel,
            gain,
            lowpass,
            formant,
            upperFormant,
            panner,
            tailUntil: 0
        };
    }

    function useVoice(index) {
        activeVoiceIndex = index;
        const voice = voices[index];
        voiceOsc1 = voice?.osc1 || null;
        voiceOsc2 = voice?.osc2 || null;
        subOsc = voice?.sub || null;
        voiceGain = voice?.gain || null;
        voiceFilter = voice?.lowpass || null;
        formantFilter = voice?.formant || null;
        upperFormantFilter = voice?.upperFormant || null;
        return voice;
    }

    function setVoiceFrequency(voice, frequency, timeConstant = .5, when = ctx.currentTime) {
        if (!voice || !Number.isFinite(frequency)) return;
        const safeFrequency = clamp(frequency, 32, 1600);
        voice.osc1.frequency.setTargetAtTime(safeFrequency, when, timeConstant);
        voice.osc2.frequency.setTargetAtTime(safeFrequency, when, timeConstant * 1.08);
        voice.sub.frequency.setTargetAtTime(safeFrequency / 2, when, timeConstant * 1.18);
    }

    function init(audioContext, destination) {
        if (ctx) return;
        rootMidi = 43;
        degreeFloat = 4;
        currentDegree = 4;
        prevAlphaIdx = null;
        sentenceBuffer = [];
        blockBuffer = [];
        dtEma = 420;
        activeVoiceIndex = 0;
        isDurScale = false;
        ctx = audioContext || new (window.AudioContext || window.webkitAudioContext)();
        
        // Master chain
        compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -20;
        compressor.ratio.value = 6;
        compressor.connect(destination || ctx.destination);
        
        masterGain = ctx.createGain();
        masterGain.gain.value = Math.pow(0.78, 1.6) * 0.9;
        masterGain.connect(compressor);
        
        dryGain = ctx.createGain();
        dryGain.gain.value = 0.7;
        dryGain.connect(masterGain);
        
        wetGain = ctx.createGain();
        wetGain.gain.value = 0.18;
        
        convolver = ctx.createConvolver();
        irBuffer = createImpulseResponse();
        convolver.buffer = irBuffer;
        
        wetGain.connect(convolver);
        convolver.connect(masterGain);
        
        // Tre förberedda röster delar långsamma rörelser och rum. Poolen gör att
        // stycken kan överlappa utan att nya permanenta ljudnoder byggs under skrivandet.
        vibratoLFO = ctx.createOscillator();
        vibratoLFO.type = 'sine';
        vibratoLFO.frequency.value = 4.5;
        vibratoGain = ctx.createGain();
        vibratoGain.gain.value = 4;
        vibratoLFO.connect(vibratoGain);

        songLFO = ctx.createOscillator();
        songLFO.type = 'sine';
        songLFO.frequency.value = 0.075;
        songGain = ctx.createGain();
        songGain.gain.value = 12;
        songLFO.connect(songGain);

        idleLFO = ctx.createOscillator();
        idleLFO.type = 'sine';
        idleLFO.frequency.value = .05;
        idleGain = ctx.createGain();
        idleGain.gain.value = 0;
        idleLFO.connect(idleGain);

        vibratoLFO.start();
        songLFO.start();
        idleLFO.start();
        voices = [0, 1, 2].map(createVoice);
        useVoice(0);
        
        noiseBuffer = createNoiseBuffer();
        
        const initialFreq = midiToFreq(degreeToMidi(currentDegree, rootMidi));
        voices.forEach((voice, index) => {
            voice.osc1.frequency.value = initialFreq * [1, .92, 1.08][index];
            voice.osc2.frequency.value = initialFreq * [1, .92, 1.08][index];
            voice.sub.frequency.value = initialFreq * [1, .92, 1.08][index] / 2;
        });
        
        isIdle = false;
        voiceGeneration = 0;
        commitCount = 0;
        responseSongCount = 0;
        lastResponseSong = null;
        pendingEnterAccent = false;
        pendingSentenceAccent = null;
        accentTimes = [];
        pairedAccentCount = 0;
        composedAccentCount = 0;
        suppressedAccentCount = 0;
        lastAccentKind = null;
        straightDoubleQuoteOpen = false;
        straightSingleQuoteOpen = false;
        blockBuffer = [];
        lastKeyTime = performance.now();
    }

    function destroy() {
        if (!ctx) return;
        clearTimeout(idleTimer);
        if (pendingEnterAccentTimer) clearTimeout(pendingEnterAccentTimer);
        if (pendingSentenceAccentTimer) clearTimeout(pendingSentenceAccentTimer);
        try {
            voices.forEach(voice => {
                voice.osc1.stop();
                voice.osc2.stop();
                voice.sub.stop();
            });
            vibratoLFO.stop();
            songLFO.stop();
            idleLFO.stop();
        } catch(e) {}
        idleTimer = null;
        idleLFO = null;
        idleGain = null;
        voices = [];
        voiceOsc1 = voiceOsc2 = subOsc = voiceGain = null;
        voiceFilter = formantFilter = upperFormantFilter = null;
        sentenceBuffer = [];
        blockBuffer = [];
        prevAlphaIdx = null;
        voiceGeneration = 0;
        commitCount = 0;
        responseSongCount = 0;
        lastResponseSong = null;
        pendingEnterAccentTimer = null;
        pendingEnterAccent = false;
        pendingSentenceAccentTimer = null;
        pendingSentenceAccent = null;
        accentTimes = [];
        pairedAccentCount = 0;
        composedAccentCount = 0;
        suppressedAccentCount = 0;
        lastAccentKind = null;
        stateObj.voicePoolSize = 0;
        stateObj.activeVoices = 0;
        stateObj.voiceGeneration = 0;
        stateObj.lastCommitKind = null;
        stateObj.lastFadeSeconds = 0;
        stateObj.lastAttackSeconds = 0;
        stateObj.responseSongCount = 0;
        stateObj.responseUsesVoicePool = true;
        stateObj.lastResponseSong = null;
        stateObj.pairedAccentCount = 0;
        stateObj.composedAccentCount = 0;
        stateObj.suppressedAccentCount = 0;
        stateObj.lastAccentKind = null;
        stateObj.pendingEnterAccent = false;
        stateObj.pendingSentenceAccent = null;
        stateObj.accentWindowSize = 0;
        isIdle = true;
        ctx = null;
    }

    function setVolume(val) {
        if (masterGain) masterGain.gain.setTargetAtTime(Math.pow(val, 1.6) * 0.9, ctx.currentTime, 0.1);
    }

    function setDepth(val) {
        depthMultiplier = clamp(Number(val) || 1, .72, 1.12);
    }

    let depthMultiplier = 1.0;
    
    // Play transient sounds
    function playTransient(type, freq, q, gainVol, duration, routing) {
        if (!ctx) return;
        const gain = ctx.createGain();
        
        if (type === 'noise') {
            const noise = ctx.createBufferSource();
            noise.buffer = noiseBuffer;
            noise.loop = true;
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = freq;
            filter.Q.value = q;
            
            gain.gain.setValueAtTime(gainVol, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
            
            noise.connect(filter);
            filter.connect(gain);
            noise.start();
            noise.stop(ctx.currentTime + duration);
        } else {
            // Sine blip
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(gainVol, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
            
            osc.connect(gain);
            osc.start();
            osc.stop(ctx.currentTime + duration);
        }
        
        if (routing === 'dry' || routing === 'both') gain.connect(dryGain);
        if (routing === 'wet' || routing === 'both') gain.connect(wetGain);
    }
    
    function playEchoPhrase(phrasePoints, exclamation) {
        if (!ctx) return;
        const phraseDur = phrasePoints.length * 0.4;
        const gainVol = exclamation ? 0.075 : 0.05;
        const pan = (Math.random() - 0.5); // ±0.5 (Enda slumpen, panorering)
        
        const echoOsc = ctx.createOscillator();
        echoOsc.type = 'sine';
        const echoGain = ctx.createGain();
        echoGain.gain.value = 0;
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 900;
        
        const panner = ctx.createStereoPanner();
        panner.pan.value = pan;
        
        echoOsc.connect(echoGain);
        echoGain.connect(filter);
        filter.connect(panner);
        panner.connect(wetGain); // Only wet
        
        echoOsc.start();
        
        let t = ctx.currentTime;
        phrasePoints.forEach(pt => {
            const freq = midiToFreq(degreeToMidi(pt.deg, rootMidi)) * 2; // EN OKTAV UPP
            const noteLen = clamp(dtEma * 0.4, 100, 240) / 1000;
            
            echoOsc.frequency.setValueAtTime(freq, t);
            echoGain.gain.setTargetAtTime(gainVol, t, 0.05);
            echoGain.gain.setTargetAtTime(0, t + noteLen * 0.5, 0.1);
            t += noteLen;
        });
        
        echoOsc.stop(t + 1.0);
    }

    function accentGain(kind, priority = 'micro') {
        if (!ctx) return 0;
        const now = ctx.currentTime;
        accentTimes = accentTimes.filter(time => now - time <= 7);
        if (priority === 'micro' && accentTimes.length >= 5) {
            suppressedAccentCount += 1;
            lastAccentKind = 'suppressed:' + kind;
            return 0;
        }
        accentTimes.push(now);
        lastAccentKind = kind;
        if (priority === 'structural') return .92;
        return clamp(1 - Math.max(0, accentTimes.length - 2) * .11, .46, 1);
    }

    function pairedSymbolDirection(key) {
        if ('([{“‘'.includes(key)) return 1;
        if (')]}”’'.includes(key)) return -1;
        if (key === '"') {
            straightDoubleQuoteOpen = !straightDoubleQuoteOpen;
            return straightDoubleQuoteOpen ? 1 : -1;
        }
        if (key === "'") {
            straightSingleQuoteOpen = !straightSingleQuoteOpen;
            return straightSingleQuoteOpen ? 1 : -1;
        }
        return 0;
    }

    function playPairedAccent(key) {
        const direction = pairedSymbolDirection(key);
        if (!direction) return false;
        const gainScale = accentGain(direction > 0 ? 'pair-open' : 'pair-close');
        if (!gainScale) return true;
        const degree = clamp(currentDegree + (direction > 0 ? 2 : 0), 0, 15);
        const frequency = midiToFreq(degreeToMidi(degree, rootMidi));
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(
            frequency * (direction > 0 ? 1.06 : .96),
            ctx.currentTime + .34
        );
        gain.gain.setValueAtTime(.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(.027 * gainScale, ctx.currentTime + .035);
        gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .52);
        oscillator.connect(gain);
        if (panner) {
            panner.pan.value = direction > 0 ? -.3 : .3;
            gain.connect(panner).connect(wetGain);
        } else {
            gain.connect(wetGain);
        }
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + .56);
        pairedAccentCount += 1;
        return true;
    }

    function cancelPendingStructuralAccents() {
        const sources = [];
        if (pendingSentenceAccentTimer) clearTimeout(pendingSentenceAccentTimer);
        if (pendingSentenceAccent) sources.push('sentence-' + pendingSentenceAccent.key);
        pendingSentenceAccentTimer = null;
        pendingSentenceAccent = null;
        if (pendingEnterAccentTimer) clearTimeout(pendingEnterAccentTimer);
        if (pendingEnterAccent) sources.push('enter');
        pendingEnterAccentTimer = null;
        pendingEnterAccent = false;
        return sources;
    }

    function queueSentenceAccent(key, phrasePoints) {
        if (pendingSentenceAccentTimer) clearTimeout(pendingSentenceAccentTimer);
        pendingSentenceAccent = { key, phrasePoints: phrasePoints.map(point => ({ ...point })) };
        pendingSentenceAccentTimer = setTimeout(() => {
            pendingSentenceAccentTimer = null;
            if (!ctx || !pendingSentenceAccent) return;
            const accent = pendingSentenceAccent;
            pendingSentenceAccent = null;
            accentGain('sentence-' + accent.key, 'phrase');
            playEchoPhrase(accent.phrasePoints, accent.key === '!');
        }, 34);
    }

    function queueEnterAccent() {
        if (pendingEnterAccentTimer) clearTimeout(pendingEnterAccentTimer);
        if (pendingSentenceAccent) {
            pendingEnterAccent = false;
            composedAccentCount += 1;
            lastAccentKind = 'composed:sentence-enter';
            return;
        }
        pendingEnterAccent = true;
        pendingEnterAccentTimer = setTimeout(() => {
            pendingEnterAccentTimer = null;
            if (!ctx || !pendingEnterAccent) return;
            pendingEnterAccent = false;
            const gainScale = accentGain('line-break', 'phrase');
            voiceGain.gain.setTargetAtTime(.19 * gainScale, ctx.currentTime, .1);
            voiceGain.gain.setTargetAtTime(0, ctx.currentTime + .2, 2.5);
        }, 28);
    }

    function emitTrace(midi, type, durMs) {
        if (onTraceCallback) {
            onTraceCallback({ midi, type, durMs });
        }
    }

    const stateObj = {
        pitchNorm: 0.5,
        tempoNorm: 0.5,
        verse: 0,
        idle: false,
        voicePoolSize: 0,
        foregroundVoice: 0,
        voiceGeneration: 0,
        activeVoices: 0,
        lastCommitKind: null,
        lastFadeSeconds: 0,
        lastAttackSeconds: 0,
        responseSongCount: 0,
        responseUsesVoicePool: true,
        lastResponseSong: null
    };
    
    function getState() {
        if (!ctx) return stateObj;
        stateObj.pitchNorm = clamp(currentDegree / 12, 0, 1);
        stateObj.tempoNorm = clamp((dtEma - 90) / (1400 - 90), 0, 1);
        stateObj.verse = commitCount;
        stateObj.idle = isIdle;
        stateObj.voicePoolSize = voices.length;
        stateObj.foregroundVoice = activeVoiceIndex;
        stateObj.voiceGeneration = voiceGeneration;
        stateObj.activeVoices = voices.filter((voice, index) =>
            index === activeVoiceIndex || voice.tailUntil > ctx.currentTime
        ).length;
        stateObj.responseSongCount = responseSongCount;
        stateObj.responseUsesVoicePool = true;
        stateObj.pairedAccentCount = pairedAccentCount;
        stateObj.composedAccentCount = composedAccentCount;
        stateObj.suppressedAccentCount = suppressedAccentCount;
        stateObj.lastAccentKind = lastAccentKind;
        stateObj.pendingEnterAccent = pendingEnterAccent;
        stateObj.pendingSentenceAccent = pendingSentenceAccent?.key || null;
        stateObj.accentWindowSize = accentTimes.length;
        stateObj.lastResponseSong = lastResponseSong ? {
            ...lastResponseSong,
            degrees: [...lastResponseSong.degrees],
            offsets: [...lastResponseSong.offsets]
        } : null;
        return {
            ...stateObj,
            lastResponseSong: stateObj.lastResponseSong
        };
    }

    function wakeUp() {
        if (isIdle) {
            isIdle = false;
            if (idleGain) {
                idleGain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
            }
        }
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
            if (!ctx) return;
            isIdle = true;
            voiceGain.gain.setTargetAtTime(0.018, ctx.currentTime, 2.5);
            idleGain.gain.setTargetAtTime(45, ctx.currentTime, 2.0); // ±45 cent

            // Glid till centerDegree vid vila
            const stats = getStats();
            const centerDegree = 2 + (stats.meanAlpha / 28) * 8;
            const targetFreq = midiToFreq(degreeToMidi(Math.round(centerDegree), rootMidi));
            voiceOsc1.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 4.0);
            voiceOsc2.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 4.0);
            subOsc.frequency.setTargetAtTime(targetFreq/2, ctx.currentTime, 4.0);
        }, 5000);
    }

    function handleKey(e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        handleChar(e.key);
    }

    function handleChar(key) {
        if (!ctx) init();
        if (ctx.state === 'suspended') ctx.resume();
        
        const now = performance.now();
        const dt = clamp(now - lastKeyTime, 60, 2000);
        lastKeyTime = now;
        
        // 9.5 Glidtid och andning
        dtEma = 0.72 * dtEma + 0.28 * dt;
        const x = clamp((dtEma - 90) / (1400 - 90), 0, 1);
        const glideTempo = lerp(0.06, 0.55, x);
        const releaseTC = lerp(0.35, 2.2, x);
        
        // Kontext från TextContext
        const stats = getStats();
        const N = stats.N || 0;
        const g = stats.g;

        const glide = glideTempo * (1 + 2 * N / (N + 400));
        
        vibratoLFO.frequency.setTargetAtTime(lerp(4.5, 0.18, x), ctx.currentTime, 0.1);
        vibratoGain.gain.setTargetAtTime(lerp(4, 18, x), ctx.currentTime, 0.1);
        wetGain.gain.setTargetAtTime(
            clamp(lerp(0.18, 0.36, x) * depthMultiplier, .15, .40),
            ctx.currentTime,
            0.1
        );
        
        wakeUp();

        // 9.4 Skalfärg och tonart
        if (stats.vowelRatio > 0.44 && !isDurScale) isDurScale = true;
        if (stats.vowelRatio < 0.40 && isDurScale) isDurScale = false;

        const verseSteps = [0, -3, 2, -5, 4];
        const newRootMidi = clamp(41 + verseSteps[stats.paragraphs % 5], 36, 48);
        if (newRootMidi !== rootMidi) {
            rootMidi = newRootMidi; // Glids per automatik på nästa frequency set
        }

        if (key === '\n') key = 'Enter';
        else if (key === '\b') key = 'Backspace';
        const lowKey = key.toLowerCase();
        const isCapital = (key !== lowKey);

        const centerDegree = 2 + (stats.meanAlpha / 28) * 8;

        if (key === 'Enter') {
            degreeFloat = 0;
            currentDegree = 0;
            const targetFreq = midiToFreq(degreeToMidi(currentDegree, rootMidi));
            voiceOsc1.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.9);
            voiceOsc2.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.9);
            subOsc.frequency.setTargetAtTime(targetFreq/2, ctx.currentTime, 0.9);
            
            queueEnterAccent();
            
            emitTrace(degreeToMidi(currentDegree, rootMidi), 'dive', 900);
            prevAlphaIdx = null;
            
        } else if (key === 'Backspace') {
            voiceOsc1.detune.setValueAtTime(0, ctx.currentTime);
            voiceOsc1.detune.linearRampToValueAtTime(-90, ctx.currentTime + 0.09);
            voiceOsc1.detune.linearRampToValueAtTime(0, ctx.currentTime + 0.22);
            voiceOsc2.detune.setValueAtTime(6, ctx.currentTime);
            voiceOsc2.detune.linearRampToValueAtTime(-84, ctx.currentTime + 0.09);
            voiceOsc2.detune.linearRampToValueAtTime(6, ctx.currentTime + 0.22);
            
            if (sentenceBuffer.length > 0) sentenceBuffer.pop();
            if (blockBuffer.length > 0) blockBuffer.pop();
            
        } else if (key === ' ') {
            const currentVol = voiceGain.gain.value;
            voiceGain.gain.setTargetAtTime(Math.max(0.02, currentVol * 0.3), ctx.currentTime, 0.05);
            // Inget degree-hopp per mellanslag. Gravitation drar vid vila eller nästa bokstav.
            
        } else if (/[.,;:!?]/.test(key)) {
            if (key === '?' || key === '.' || key === '!') {
                // Suck vid meningsslut
                degreeFloat -= 1;
                currentDegree = Math.round(degreeFloat);
                
                const targetFreq = midiToFreq(degreeToMidi(currentDegree, rootMidi));
                voiceOsc1.frequency.setTargetAtTime(targetFreq, ctx.currentTime, glide * 1.6);
                voiceOsc2.frequency.setTargetAtTime(targetFreq, ctx.currentTime, glide * 1.6);
                subOsc.frequency.setTargetAtTime(targetFreq/2, ctx.currentTime, glide * 1.6);
                
                voiceGain.gain.setTargetAtTime(key === '!' ? 0.26 : 0.17, ctx.currentTime, 0.1);
                
                const maxPoints = 14;
                let step = Math.max(1, Math.floor(sentenceBuffer.length / maxPoints));
                let phrasePoints = sentenceBuffer.filter((_, i) => i % step === 0).slice(-maxPoints);
                
                if (key === '?') phrasePoints.push({deg: currentDegree + 2});
                else if (key === '!') { phrasePoints.push(sentenceBuffer[sentenceBuffer.length-1] || {deg: currentDegree}); phrasePoints.push({deg: currentDegree}); }
                else phrasePoints.push({deg: currentDegree});
                
                queueSentenceAccent(key, phrasePoints);
                
                const fadeDur = clamp(sentenceBuffer.length * 0.09, 1.5, 8);
                voiceGain.gain.setTargetAtTime(0.02, ctx.currentTime + 0.5, fadeDur / 3);
                
                sentenceBuffer = [];
                prevAlphaIdx = null;
            } else {
                degreeFloat -= 1;
                currentDegree = Math.round(degreeFloat);
                const targetFreq = midiToFreq(degreeToMidi(currentDegree, rootMidi));
                voiceOsc1.frequency.setTargetAtTime(targetFreq, ctx.currentTime, glide * 1.3);
                voiceOsc2.frequency.setTargetAtTime(targetFreq, ctx.currentTime, glide * 1.3);
                subOsc.frequency.setTargetAtTime(targetFreq/2, ctx.currentTime, glide * 1.3);
                voiceGain.gain.setTargetAtTime(0.10, ctx.currentTime, 0.1);
            }
            
        } else if (playPairedAccent(key)) {
            sentenceBuffer.push({deg: currentDegree});
            blockBuffer.push({deg: currentDegree, vowel: false, ix: -1});
        } else if (/[0-9]/.test(key)) {
            const num = parseInt(key);
            const freq = 1200 + num * 130;
            
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
            
            osc.connect(gain);
            gain.connect(wetGain);
            
            osc.start();
            osc.stop(ctx.currentTime + 0.12);
            
        } else if (ALPHABET.includes(lowKey)) {
            const ix = ALPHABET.indexOf(lowKey);
            const isVowel = ['a','o','u','å','e','i','y','ä','ö'].includes(lowKey);
            
            // 9.3 Melodisteg deterministiskt
            let steps = 0;
            if (prevAlphaIdx !== null) {
                const diff = ix - prevAlphaIdx;
                steps = clamp(Math.round(diff / 5), -3, 3);
                if (steps === 0 && diff !== 0) {
                    steps = diff > 0 ? 1 : -1;
                }
            }
            prevAlphaIdx = ix;
            
            const effSteps = steps * g;
            degreeFloat = degreeFloat + effSteps + 0.08 * (centerDegree - degreeFloat);
            degreeFloat = clamp(degreeFloat, 0, 15);
            currentDegree = Math.round(degreeFloat);
            
            const targetFreq = midiToFreq(degreeToMidi(currentDegree, rootMidi));
            
            const transientGainScale = (0.5 + 0.5 * g);
            let traceType = isVowel ? 'vowel' : 'cons';
            
            if (isVowel) {
                voiceOsc1.frequency.setTargetAtTime(targetFreq, ctx.currentTime, glide);
                voiceOsc2.frequency.setTargetAtTime(targetFreq, ctx.currentTime, glide);
                subOsc.frequency.setTargetAtTime(targetFreq/2, ctx.currentTime, glide);
                const openness = clamp(stats.vowelRatio, .2, .65);
                formantFilter.frequency.setTargetAtTime(430 + openness * 470 + ix * 4, ctx.currentTime, .18);
                upperFormantFilter.frequency.setTargetAtTime(880 + openness * 680 + ix * 7, ctx.currentTime, .22);
                voiceGain.gain.setTargetAtTime(0.20, ctx.currentTime, 0.05);
                voiceGain.gain.setTargetAtTime(0.05, ctx.currentTime + 0.1, releaseTC);
            } else {
                voiceOsc1.frequency.setTargetAtTime(targetFreq, ctx.currentTime, glide * 0.6);
                voiceOsc2.frequency.setTargetAtTime(targetFreq, ctx.currentTime, glide * 0.6);
                subOsc.frequency.setTargetAtTime(targetFreq/2, ctx.currentTime, glide * 0.6);
                voiceGain.gain.setTargetAtTime(0.13, ctx.currentTime, 0.03);
                voiceGain.gain.setTargetAtTime(0.05, ctx.currentTime + 0.05, releaseTC * 0.8);
                
                if ('ptkbdg'.includes(lowKey)) {
                    playTransient('noise', 1100 + 45 * ix, 7, 0.08 * transientGainScale, 0.05, 'both');
                } else if ('sfvzchj'.includes(lowKey)) {
                    const dur = clamp(dtEma * 0.5, 120, 500) / 1000;
                    playTransient('noise', targetFreq * 4, 1.6, 0.1 * transientGainScale, dur, 'wet');
                } else if ('mnlr'.includes(lowKey)) {
                    playTransient('sine', targetFreq / 2, 1, 0.09 * transientGainScale, 0.16, 'both');
                }
            }
            
            if (isCapital) {
                const octQuintFreq = midiToFreq(degreeToMidi(currentDegree, rootMidi) + 19);
                playTransient('sine', octQuintFreq, 1, 0.05 * transientGainScale, 1.2, 'wet');
            }
            
            sentenceBuffer.push({deg: currentDegree});
            blockBuffer.push({deg: currentDegree, vowel: isVowel, ix});
            emitTrace(degreeToMidi(currentDegree, rootMidi), traceType, isVowel ? 300 : 150);
        }
    }

    function textSignature(text) {
        return Array.from(String(text || '').toLowerCase()).reduce(
            (sum, character, index) => (sum + character.charCodeAt(0) * (index + 3)) % 4093,
            17
        );
    }

    function textContour(text, startDegree) {
        const letters = Array.from(String(text || '').toLowerCase())
            .map(character => ALPHABET.indexOf(character))
            .filter(index => index >= 0);
        if (!letters.length) return [clamp(Math.round(startDegree), 0, 15)];
        let degree = clamp(Math.round(startDegree), 0, 15);
        let previous = letters[0];
        return letters.map((index, position) => {
            if (position) {
                const difference = index - previous;
                let step = clamp(Math.round(difference / 5), -3, 3);
                if (!step && difference) step = difference > 0 ? 1 : -1;
                degree = clamp(degree + step, 0, 15);
            }
            previous = index;
            return degree;
        });
    }

    function sampleContour(contour, count) {
        if (count <= 1) return [contour[contour.length - 1] ?? currentDegree];
        return Array.from({ length: count }, (_, index) => {
            const sourceIndex = Math.round(index * (contour.length - 1) / (count - 1));
            return contour[sourceIndex] ?? contour[contour.length - 1] ?? currentDegree;
        });
    }

    function buildResponseSong(kind, blockProfile, musicalContext) {
        const heading = kind === 'heading';
        const text = String(blockProfile.text || '');
        const words = Math.max(0, Number(blockProfile.words) || text.trim().split(/\s+/).filter(Boolean).length);
        const letterCount = Array.from(text.toLowerCase()).filter(character => ALPHABET.includes(character)).length;
        const micro = !heading && (words <= 2 || letterCount < 10);
        const goalMilestone = [25, 50, 75, 100].includes(Number(blockProfile.goalMilestone))
            ? Number(blockProfile.goalMilestone)
            : null;
        const ending = text.trim().slice(-1);
        const profileIndex = (
            musicalContext.signature +
            (heading ? 2 : 0) +
            (ending === '?' ? 1 : 0) +
            Math.round(musicalContext.similarity * 3)
        ) % CALL_REPERTOIRE.length;
        const callProfile = micro
            ? CALL_PROFILES.upcall
            : CALL_REPERTOIRE[profileIndex];
        const noteCount = heading ? 4 : micro ? 2 : words <= 8 ? 3 : clamp(4 + Math.floor(words / 34), 4, 7);
        const typedContour = blockBuffer.map(point => point.deg);
        const source = typedContour.length >= 3
            ? typedContour
            : textContour(text, musicalContext.inheritedDegree);
        const sampled = sampleContour(source, noteCount);
        const answerDirection = musicalContext.similarity >= .56 ? 1 : -1;
        const intervalScale = 1 + Math.round((1 - musicalContext.similarity) * 1.5);
        const degrees = [clamp(Math.round(musicalContext.startDegree), 0, 15)];
        for (let index = 1; index < sampled.length; index++) {
            const sourceInterval = clamp(sampled[index] - sampled[index - 1], -3, 3);
            const fallback = ((musicalContext.signature >>> index) & 1) ? 1 : -1;
            const interval = (sourceInterval || fallback) * answerDirection * intervalScale;
            degrees.push(clamp(degrees[index - 1] + interval, 0, 15));
        }

        if (heading) {
            degrees[degrees.length - 1] = clamp(degrees[0] + 3, 0, 15);
        } else if (ending === '?') {
            degrees[degrees.length - 1] = clamp(degrees[degrees.length - 2] + 2, 0, 15);
        } else if (ending === '!') {
            degrees[degrees.length - 1] = degrees[degrees.length - 2];
        } else {
            degrees[degrees.length - 1] = clamp(
                Math.round(degrees[degrees.length - 1] * .7 + musicalContext.endDegree * .3) - 1,
                0,
                15
            );
        }

        for (let index = 0; index < degrees.length; index++) {
            let shapedDegree = degrees[index] + callProfile.degreeBias;
            if (callProfile.type === 'deep-moan') {
                shapedDegree -= Math.floor(index / 2);
            } else if (callProfile.type === 'upcall') {
                shapedDegree += Math.round(index * 2 / Math.max(1, degrees.length - 1));
            } else if (callProfile.type === 'warble') {
                shapedDegree += index % 2 ? 1 : index ? -1 : 0;
            } else if (callProfile.type === 'pulse-train' && index > 0) {
                shapedDegree = degrees[index - 1] + callProfile.degreeBias + (index % 3 === 0 ? -1 : 0);
            }
            degrees[index] = clamp(Math.round(shapedDegree), 0, 15);
        }
        if (goalMilestone) {
            degrees[degrees.length - 1] = clamp(
                degrees[degrees.length - 1] + (goalMilestone >= 75 ? 2 : 1),
                0,
                15
            );
        }

        const noteSeconds = clamp(
            .46 + musicalContext.localSentenceWords * .012 + musicalContext.localVowelRatio * .22,
            .54,
            .96
        ) * callProfile.durationScale;
        const offsets = degrees.map((_, index) => index * noteSeconds * callProfile.spacingScale);
        const startDelay = heading
            ? Math.min(.4, callProfile.startDelay)
            : callProfile.startDelay + musicalContext.similarity * .12;
        const durationSeconds = startDelay + offsets[offsets.length - 1] + noteSeconds * 1.18;
        return {
            kind: heading ? 'heading' : 'paragraph',
            role: heading ? 'theme-call' : micro ? 'micro-answer' : 'answer-song',
            relationship: heading
                ? 'section-call'
                : musicalContext.similarity >= .56 ? 'echo' : 'counter-call',
            cadence: heading
                ? 'section'
                : ending === '?' ? 'question' : ending === '!' ? 'exclamation' : 'resolution',
            callType: callProfile.type,
            callFamily: callProfile.family,
            goalMilestone,
            signature: musicalContext.signature,
            source: typedContour.length >= 3 ? 'typed-contour' : 'block-text',
            similarity: musicalContext.similarity,
            vowelRatio: musicalContext.localVowelRatio,
            degrees,
            offsets,
            noteSeconds,
            startDelay,
            durationSeconds,
            pan: clamp(((musicalContext.signature % 201) - 100) / 260, -.38, .38),
            words,
            timbre: {
                fundamental: callProfile.fundamental,
                overtone: callProfile.overtone,
                sub: callProfile.sub,
                lowpass: callProfile.lowpass,
                formantBias: callProfile.formantBias,
                songDepth: callProfile.songDepth + (goalMilestone ? goalMilestone * .035 : 0)
            }
        };
    }

    function commit(kind = 'paragraph', blockProfile = {}) {
        if (!ctx || !voices.length) return;
        if (!String(blockProfile.text || '').trim()) return;
        const now = ctx.currentTime;
        const pendingAccentSources = cancelPendingStructuralAccents();
        const heading = kind === 'heading';
        const headingLevel = clamp(Number(blockProfile.level) || contextStats.lastHeadingLevel || 1, 1, 3);
        const similarity = clamp(
            Number.isFinite(Number(blockProfile.similarityToPrevious))
                ? Number(blockProfile.similarityToPrevious)
                : contextStats.cohesion * .62 + contextStats.connectedness * .38,
            0,
            1
        );
        const localVowelRatio = clamp(Number(blockProfile.vowelRatio) || contextStats.vowelRatio, .2, .65);
        const localSentenceWords = clamp(
            Number(blockProfile.averageSentenceWords) || contextStats.averageSentenceWords,
            3,
            45
        );
        const signature = textSignature(blockProfile.text) + blockBuffer.reduce(
            (sum, point, index) => sum + (point.deg + 1) * (index + 5),
            0
        );
        const direction = signature % 2 ? 1 : -1;
        const inheritedDegree = blockBuffer.length
            ? blockBuffer.slice(-8).reduce((sum, point) => sum + point.deg, 0) / Math.min(8, blockBuffer.length)
            : currentDegree;
        const contourDistance = heading
            ? 2 + headingLevel
            : 1 + Math.round((1 - similarity) * 3);

        if (heading) {
            const headingSteps = [-5, 2, 4];
            rootMidi = clamp(43 + headingSteps[headingLevel - 1] + (signature % 3) - 1, 36, 50);
        }

        const oldVoice = voices[activeVoiceIndex];
        const nextIndex = (activeVoiceIndex + 1) % voices.length;
        const nextVoice = voices[nextIndex];
        const fadeSeconds = clamp((heading ? 10 : 8) + similarity * 4, 8, 14);
        const attackSeconds = clamp((heading ? 2.7 : 2.1) + (1 - similarity) * .45, 2, 3.2);
        const localWords = Math.max(
            0,
            Number(blockProfile.words) || String(blockProfile.text || '').trim().split(/\s+/).filter(Boolean).length
        );
        const targetGain = (heading ? .145 : localWords <= 2 ? .09 : .125) *
            ([25, 50, 75, 100].includes(Number(blockProfile.goalMilestone)) ? 1.06 : 1);

        oldVoice.gain.gain.cancelScheduledValues(now);
        oldVoice.gain.gain.setValueAtTime(clamp(oldVoice.gain.gain.value || .12, .0001, .2), now);
        oldVoice.gain.gain.setTargetAtTime(.0001, now + .16, fadeSeconds / 3);
        oldVoice.tailUntil = now + fadeSeconds;

        nextVoice.gain.gain.cancelScheduledValues(now);
        nextVoice.gain.gain.setValueAtTime(.0001, now);
        nextVoice.gain.gain.setTargetAtTime(targetGain, now + .04, attackSeconds / 3);
        nextVoice.tailUntil = 0;

        const startDegree = clamp(Math.round(inheritedDegree + direction * contourDistance), 0, 15);
        const middleDegree = clamp(startDegree + direction * (heading ? 2 : 1), 0, 15);
        const endDegree = clamp(
            middleDegree + (signature % 3 === 0 ? -direction : direction) * (heading ? 2 : 1),
            0,
            15
        );
        const startFrequency = midiToFreq(degreeToMidi(startDegree, rootMidi));
        const detuneBias = signature % 37 - 18;
        const responseSong = buildResponseSong(kind, blockProfile, {
            signature,
            similarity,
            localVowelRatio,
            localSentenceWords,
            inheritedDegree,
            startDegree,
            endDegree
        });

        for (const [oscillator, ratio] of [
            [nextVoice.osc1, 1],
            [nextVoice.osc2, 1],
            [nextVoice.sub, .5]
        ]) {
            oscillator.frequency.cancelScheduledValues(now);
            oscillator.frequency.setValueAtTime(Math.max(30, startFrequency * ratio * .78), now);
            oscillator.frequency.exponentialRampToValueAtTime(
                Math.max(30, startFrequency * ratio),
                now + responseSong.startDelay
            );
            responseSong.degrees.forEach((degree, index) => {
                const responseFrequency = midiToFreq(degreeToMidi(degree, rootMidi));
                oscillator.frequency.exponentialRampToValueAtTime(
                    Math.max(30, responseFrequency * ratio),
                    now + responseSong.startDelay + responseSong.offsets[index] + responseSong.noteSeconds * .58
                );
            });
        }
        nextVoice.osc1.detune.setValueAtTime(detuneBias, now);
        nextVoice.osc2.detune.setValueAtTime(detuneBias + 5 + nextIndex * 1.5, now);
        nextVoice.fundamentalLevel.gain.setTargetAtTime(responseSong.timbre.fundamental, now, .7);
        nextVoice.overtoneLevel.gain.setTargetAtTime(responseSong.timbre.overtone, now, .7);
        nextVoice.subLevel.gain.setTargetAtTime(responseSong.timbre.sub, now, .7);
        nextVoice.lowpass.frequency.setTargetAtTime(
            responseSong.timbre.lowpass + localVowelRatio * 260,
            now,
            .7
        );
        nextVoice.formant.frequency.setTargetAtTime(
            430 + localVowelRatio * 520 + responseSong.timbre.formantBias,
            now,
            .55
        );
        nextVoice.upperFormant.frequency.setTargetAtTime(
            900 + localVowelRatio * 760 + responseSong.timbre.formantBias * .7,
            now,
            .7
        );
        songGain.gain.setTargetAtTime(responseSong.timbre.songDepth, now, 1.4);
        if (responseSong.callType === 'pulse-train') {
            responseSong.offsets.forEach((offset, index) => {
                const pulseTime = now + responseSong.startDelay + offset;
                nextVoice.gain.gain.setTargetAtTime(targetGain * (index % 3 === 2 ? .72 : 1), pulseTime, .045);
                nextVoice.gain.gain.setTargetAtTime(targetGain * .34, pulseTime + responseSong.noteSeconds * .48, .08);
            });
            nextVoice.gain.gain.setTargetAtTime(targetGain * .62, now + responseSong.durationSeconds, .5);
        }
        if (nextVoice.panner) {
            const spread = .08 + (1 - similarity) * .22;
            nextVoice.panner.pan.setTargetAtTime(
                clamp(direction * spread * .65 + responseSong.pan * .35, -.36, .36),
                now,
                .8
            );
        }

        useVoice(nextIndex);
        currentDegree = endDegree;
        degreeFloat = endDegree;
        commitCount += 1;
        voiceGeneration += 1;
        stateObj.lastCommitKind = heading ? 'heading' : 'paragraph';
        stateObj.lastFadeSeconds = fadeSeconds;
        stateObj.lastAttackSeconds = attackSeconds;
        responseSongCount += 1;
        lastResponseSong = {
            ...responseSong,
            degrees: [...responseSong.degrees],
            offsets: [...responseSong.offsets],
            accentComposition: [
                ...pendingAccentSources,
                heading ? 'heading' : 'commit',
                responseSong.goalMilestone ? 'goal-' + responseSong.goalMilestone : null
            ].filter(Boolean),
            poolVoice: nextIndex
        };
        if (lastResponseSong.accentComposition.length > 1) composedAccentCount += 1;
        accentGain(heading ? 'heading' : 'commit', 'structural');
        if (responseSong.goalMilestone) accentGain('goal-' + responseSong.goalMilestone, 'structural');
        playTransient('noise', 310 + localVowelRatio * 260, .72, heading ? .036 : .025, 1.15, 'wet');
        emitTrace(degreeToMidi(startDegree, rootMidi), heading ? 'theme' : 'voice', attackSeconds * 1000);
        sentenceBuffer = [];
        blockBuffer = [];
        prevAlphaIdx = null;
    }

    return {
        init,
        destroy,
        handleKey,
        handleChar,
        setVolume,
        setDepth,
        setContext,
        commit,
        mute: (m) => setVolume(m ? 0 : 0.6), // Standardvolym 0.6, justeras av slider
        onTrace: (cb) => { onTraceCallback = cb; },
        getState
    };
})();
