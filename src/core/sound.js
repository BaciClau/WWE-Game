// ============ SOUND & HAPTICS ============
// Every cue is synthesized on the fly with the Web Audio API — no binary asset files, so
// nothing to fetch, cache, or fight with GitHub Pages' case-sensitive paths over. Muted by
// default until the player's first tap (browsers block audio before a user gesture anyway),
// and fully OFF if they flip the toggle — player.soundOn persists the choice like any other
// preference.
//
// Built on a few reusable "instruments" (voice/bell/thump/sweep/noise) instead of flat
// single-oscillator beeps: unison-detuned voices for body, a lowpass for warmth, a shared
// convolver reverb bus for depth, and real envelopes (attack/hold/release) instead of a bare
// exponential decay — the difference between an arcade cabinet and a browser `beep()`.

let _audioCtx = null;
let _reverbNode = null; // shared convolver — one short synthetic room, reused by everything
let _dryBus = null, _wetBus = null;

function _buildReverbImpulse(ctx, duration = 1.4, decay = 2.6) {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * duration);
    const impulse = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
        const data = impulse.getChannelData(ch);
        for (let i = 0; i < len; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
        }
    }
    return impulse;
}

function _getAudioCtx() {
    if (!player.soundOn) return null;
    if (!_audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        _audioCtx = new Ctx();
        // Dry bus: straight to speakers. Wet bus: through the reverb, mixed back in quiet —
        // gives every cue a touch of room/depth instead of sounding like it's coming out of
        // a dry, flat buzzer.
        _dryBus = _audioCtx.createGain();
        _dryBus.gain.value = 1;
        _dryBus.connect(_audioCtx.destination);

        _reverbNode = _audioCtx.createConvolver();
        _reverbNode.buffer = _buildReverbImpulse(_audioCtx);
        _wetBus = _audioCtx.createGain();
        _wetBus.gain.value = 0.22;
        _reverbNode.connect(_wetBus);
        _wetBus.connect(_audioCtx.destination);
    }
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
    return _audioCtx;
}

// Routes a node to both the dry output and the shared reverb tail.
function _sendToBus(ctx, node) {
    node.connect(_dryBus);
    node.connect(_reverbNode);
}

// One oscillator "voice" with a proper attack/hold/release envelope, optional unison detune
// (extra slightly-detuned copies for a fuller, less thin sound) and an optional lowpass for
// warmth. This is the workhorse every musical cue below is built from.
function _voice(ctx, { freq, type = 'sine', duration = 0.3, volume = 0.16, delay = 0,
                        attack = 0.012, release, detuneVoices = 1, detuneCents = 9,
                        filterFreq = null, filterQ = 0.7, pan = 0 }) {
    const t0 = ctx.currentTime + delay;
    const rel = release != null ? release : duration * 0.6;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + attack);
    gain.gain.setValueAtTime(volume, t0 + Math.max(attack, duration - rel));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    let out = gain;
    if (filterFreq) {
        const filt = ctx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.value = filterFreq;
        filt.Q.value = filterQ;
        gain.connect(filt);
        out = filt;
    }
    if (pan && ctx.createStereoPanner) {
        const panner = ctx.createStereoPanner();
        panner.pan.value = Math.max(-1, Math.min(1, pan));
        out.connect(panner);
        out = panner;
    }
    _sendToBus(ctx, out);

    const n = Math.max(1, detuneVoices);
    for (let i = 0; i < n; i++) {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = freq;
        if (n > 1) osc.detune.value = (i - (n - 1) / 2) * detuneCents;
        osc.connect(gain);
        osc.start(t0);
        osc.stop(t0 + duration + 0.05);
    }
    return t0;
}

// A short additive "bell" — fundamental + a couple of quieter, faster-decaying overtones —
// reads as a real chime/ding instead of a flat square-wave beep. Used for rewards/pulls.
function _bell(ctx, freq, { duration = 0.5, volume = 0.16, delay = 0, pan = 0 } = {}) {
    _voice(ctx, { freq, type: 'sine', duration, volume, delay, attack: 0.004, release: duration * 0.85, pan });
    _voice(ctx, { freq: freq * 2.01, type: 'sine', duration: duration * 0.6, volume: volume * 0.35, delay, attack: 0.004, release: duration * 0.5, pan });
    _voice(ctx, { freq: freq * 3.0, type: 'sine', duration: duration * 0.35, volume: volume * 0.18, delay, attack: 0.003, release: duration * 0.3, pan });
}

// Low-end impact: a fast pitch-drooping sine "sub" thump, no unison/reverb needed — this is
// felt more than heard, like a body shot landing.
function _thump(ctx, { startFreq = 130, endFreq = 45, duration = 0.22, volume = 0.28, delay = 0 } = {}) {
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t0 + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    _sendToBus(ctx, gain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
}

// Filtered noise burst — a crack/hit texture, layered on top of _thump for the round-clash
// impact, or used alone for a softer "tick".
function _noiseBurst(ctx, { duration = 0.18, volume = 0.2, delay = 0, filterFreq = 1200, filterType = 'lowpass' } = {}) {
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.6);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    const t0 = ctx.currentTime + delay;
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter);
    filter.connect(gain);
    _sendToBus(ctx, gain);
    src.start(t0);
}

// A fast frequency sweep — electric "zap" texture for ability procs, distinct from any
// musical tone.
function _sweep(ctx, { startFreq = 300, endFreq = 1600, duration = 0.12, volume = 0.14, delay = 0, type = 'sawtooth' } = {}) {
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t0 + duration);
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = (startFreq + endFreq) / 2;
    filt.Q.value = 1.2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(filt);
    filt.connect(gain);
    _sendToBus(ctx, gain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
}

// Chord/arpeggio helper: plays a list of frequencies through _voice with a shared "feel",
// each note optionally staggered (arpeggiated) via `stagger`.
function _run(ctx, freqs, { type = 'triangle', noteDuration = 0.2, volume = 0.13, stagger = 0.07,
                             delay = 0, detuneVoices = 2, filterFreq = 3200, pan = 0 } = {}) {
    freqs.forEach((f, i) => _voice(ctx, {
        freq: f, type, duration: noteDuration, volume, delay: delay + i * stagger,
        detuneVoices, filterFreq, pan,
    }));
}

// Musical intervals as ratios off a root — used instead of hand-picked Hz lists so every
// cue's chord actually makes harmonic sense (major = bright/good, minor = moody/bad).
const IVAL = { root: 1, m2: 1.0595, M2: 1.1225, m3: 1.1892, M3: 1.2599, P4: 1.3348, P5: 1.4983, M6: 1.6818, m7: 1.7818, oct: 2, oct2: 3, oct3: 4 };
function _chordFreqs(root, ratios) { return ratios.map(r => root * r); }

const NOTE_C5 = 523.25, NOTE_E5 = 659.25, NOTE_G5 = 783.99, NOTE_C6 = 1046.5, NOTE_A4 = 440;

// Semantic cue names — every call site says WHAT happened, not which notes to play, so the
// actual sound design lives in exactly one place.
const SFX_DEFS = {
    select:       ctx => _voice(ctx, { freq: 660, type: 'triangle', duration: 0.07, volume: 0.09, filterFreq: 4000, detuneVoices: 1 }),
    deselect:     ctx => _voice(ctx, { freq: 420, type: 'triangle', duration: 0.07, volume: 0.07, filterFreq: 3000, detuneVoices: 1 }),
    confirm:      ctx => {
        _voice(ctx, { freq: 349.2, type: 'square', duration: 0.09, volume: 0.1, filterFreq: 2200, detuneVoices: 2, detuneCents: 6 });
        _voice(ctx, { freq: 523.25, type: 'square', duration: 0.14, volume: 0.11, delay: 0.06, filterFreq: 2600, detuneVoices: 2, detuneCents: 6 });
        _noiseBurst(ctx, { duration: 0.05, volume: 0.08, filterFreq: 3500 });
    },
    clash:        ctx => { _thump(ctx, { startFreq: 150, endFreq: 45, duration: 0.24, volume: 0.3 }); _noiseBurst(ctx, { duration: 0.16, volume: 0.22, filterFreq: 900 }); },
    win:          ctx => {
        _run(ctx, _chordFreqs(NOTE_C5, [IVAL.root, IVAL.M3, IVAL.P5, IVAL.oct]), { type: 'triangle', noteDuration: 0.35, volume: 0.15, stagger: 0.1, detuneVoices: 2, filterFreq: 3800 });
        _voice(ctx, { freq: NOTE_C6, type: 'triangle', duration: 0.9, volume: 0.08, delay: 0.34, detuneVoices: 3, detuneCents: 7, filterFreq: 4200 });
    },
    lose:         ctx => {
        _run(ctx, [NOTE_A4, NOTE_A4 * IVAL.m3, NOTE_A4 / IVAL.M2], { type: 'sawtooth', noteDuration: 0.4, volume: 0.11, stagger: 0.13, detuneVoices: 2, filterFreq: 900 });
    },
    draw:         ctx => _run(ctx, [NOTE_A4, NOTE_A4 * IVAL.M2, NOTE_A4], { type: 'triangle', noteDuration: 0.18, volume: 0.09, stagger: 0.16, detuneVoices: 1, filterFreq: 2200 }),
    levelup:      ctx => {
        _run(ctx, _chordFreqs(NOTE_G5 * 0.75, [IVAL.root, IVAL.M2, IVAL.M3, IVAL.P5, IVAL.oct]), { type: 'square', noteDuration: 0.16, volume: 0.09, stagger: 0.055, detuneVoices: 2, filterFreq: 3600 });
        _bell(ctx, NOTE_C6 * 1.5, { duration: 0.4, volume: 0.1, delay: 0.24 });
    },
    ability:      ctx => { _sweep(ctx, { startFreq: 700, endFreq: 2200, duration: 0.09, volume: 0.13 }); _sweep(ctx, { startFreq: 1800, endFreq: 500, duration: 0.07, volume: 0.08, delay: 0.05 }); },
    chemistry:    ctx => _run(ctx, _chordFreqs(NOTE_C5, [IVAL.root, IVAL.M3, IVAL.P5]), { type: 'sine', noteDuration: 0.45, volume: 0.11, stagger: 0, detuneVoices: 3, detuneCents: 6, filterFreq: 2800 }),
    chemistryBad: ctx => _run(ctx, [220, 220 * IVAL.m2], { type: 'sawtooth', noteDuration: 0.35, volume: 0.12, stagger: 0, detuneVoices: 2, filterFreq: 700 }),
    pull:         ctx => { _bell(ctx, NOTE_E5, { duration: 0.35, volume: 0.12 }); _bell(ctx, NOTE_G5 * IVAL.oct * 0.5 * 2, { duration: 0.45, volume: 0.12, delay: 0.08 }); _bell(ctx, NOTE_C6 * 1.26, { duration: 0.55, volume: 0.11, delay: 0.16 }); },
    reward:       ctx => { _bell(ctx, NOTE_E5, { duration: 0.3, volume: 0.13 }); _bell(ctx, NOTE_C6, { duration: 0.5, volume: 0.14, delay: 0.1 }); },
    error:        ctx => _voice(ctx, { freq: 140, type: 'square', duration: 0.16, volume: 0.11, filterFreq: 500, detuneVoices: 2, detuneCents: 20 }),
    notify:       ctx => _bell(ctx, NOTE_G5, { duration: 0.25, volume: 0.09 }),
    champion:     ctx => {
        _run(ctx, _chordFreqs(NOTE_C5 * 0.75, [IVAL.root, IVAL.M3, IVAL.P5, IVAL.oct, IVAL.oct * IVAL.M3]), { type: 'triangle', noteDuration: 0.45, volume: 0.14, stagger: 0.09, detuneVoices: 3, detuneCents: 8, filterFreq: 4200 });
        _bell(ctx, NOTE_C6 * IVAL.P5 * 0.5, { duration: 1.1, volume: 0.13, delay: 0.42 });
        _voice(ctx, { freq: NOTE_C5 / 2, type: 'triangle', duration: 0.6, volume: 0.09, delay: 0, filterFreq: 900, detuneVoices: 2 });
    },
};

function playSfx(name) {
    const def = SFX_DEFS[name];
    if (!def) return;
    const ctx = _getAudioCtx();
    if (!ctx) return;
    try { def(ctx); } catch (e) { /* audio is pure polish — never let it break gameplay */ }
}

// Haptic pulse, gated by the same toggle as sound (one "FX" preference, not two settings to
// hunt for) and by actual device support.
const HAPTIC_PATTERNS = {
    tap: 10,
    confirm: 20,
    win: [30, 40, 30, 60],
    lose: 80,
    levelup: [15, 30, 15],
};
function vibrate(name) {
    if (!player.soundOn) return;
    if (!navigator.vibrate) return;
    const pattern = HAPTIC_PATTERNS[name];
    if (pattern) navigator.vibrate(pattern);
}

function toggleGameSound() {
    player.soundOn = !player.soundOn;
    save(false);
    updateSoundToggleUI();
    if (player.soundOn) playSfx('notify');
}
// Lives inside the ⚙️ OPTIONS modal (index.html) — see openOptionsModal() in state.js.
function updateSoundToggleUI() {
    const btn = document.getElementById('options-sound-btn');
    if (!btn) return;
    btn.innerText = player.soundOn ? '🔊 SOUND: ON' : '🔇 SOUND: OFF';
    btn.classList.toggle('sound-off', !player.soundOn);
}
