/* ============================================================================
   HorrorAudio: a procedural horror soundscape for Haunted Mode.

   Everything is synthesised with the WebAudio API, so there are no audio files,
   no downloads, no licensing concerns, and it works fully offline.

   Layers (all scale with the haunting level, 0 to 100):
   - Drone:      a dissonant minor-second cluster that laptop speakers can play,
                 with a slow filter sweep.
   - Whine:      a high, beating, trembling tone that creeps in above level ~25.
   - Wind:       breathy filtered noise.
   - Heartbeat:  a lub-dub that speeds up as the level rises.
   - Events:     random whispers, metallic creaks and a detuned music box.
   - Stinger:    a loud swell for the terminal crash.

   Every sound method takes an optional start time, which keeps the engine
   testable with an OfflineAudioContext.
   ============================================================================ */

type AnyAudioContext = BaseAudioContext;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

export class HorrorAudio {
  readonly ctx: AnyAudioContext;

  private bus: GainNode; // everything routes here (dry + reverb)
  private master: GainNode;
  private droneGain: GainNode;
  private droneFilter: BiquadFilterNode;
  private whineGain: GainNode;
  private windGain: GainNode;
  private noise: AudioBuffer;
  private sources: AudioScheduledSourceNode[] = [];
  private timers: number[] = [];

  private level = 0;
  private muted = true;
  private gentle = false;
  private disposed = false;

  constructor(ctx?: AnyAudioContext) {
    if (ctx) {
      this.ctx = ctx;
    } else {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) throw new Error('WebAudio is not supported in this browser');
      this.ctx = new Ctor();
    }
    const c = this.ctx;

    // ----- Output chain: bus -> (dry + reverb) -> compressor -> master -----
    this.bus = c.createGain();
    const dry = c.createGain();
    dry.gain.value = 0.8;
    const reverb = c.createConvolver();
    reverb.buffer = this.makeImpulse(2.8, 2.4);
    const wet = c.createGain();
    wet.gain.value = 0.55;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 5;
    this.master = c.createGain();
    this.master.gain.value = 0.0001;

    this.bus.connect(dry);
    this.bus.connect(reverb);
    reverb.connect(wet);
    dry.connect(comp);
    wet.connect(comp);
    comp.connect(this.master);
    this.master.connect(c.destination);

    this.noise = this.makeNoise(2.5);

    // ----- Drone: a minor-second cluster (E2 + F2) plus a sub -----
    this.droneGain = c.createGain();
    this.droneGain.gain.value = 0.0001;
    this.droneFilter = c.createBiquadFilter();
    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.value = 380;
    this.droneFilter.Q.value = 2.5;
    const mkOsc = (type: OscillatorType, freq: number, gain: number) => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const g = c.createGain();
      g.gain.value = gain;
      o.connect(g);
      g.connect(this.droneFilter);
      this.track(o);
      return o;
    };
    mkOsc('sawtooth', 82.41, 0.5);
    mkOsc('sawtooth', 87.31, 0.45);
    mkOsc('sine', 41.2, 0.7);
    this.droneFilter.connect(this.droneGain);
    this.droneGain.connect(this.bus);
    // slow breathing sweep of the filter
    this.lfo(0.07, 160, this.droneFilter.frequency);

    // ----- Whine: two close high sines that beat, with a slow tremble -----
    // The tremolo has its own gain stage so the level control stays silent when it should be.
    this.whineGain = c.createGain();
    this.whineGain.gain.value = 0.0001;
    const trem = c.createGain();
    trem.gain.value = 0.6;
    const w1 = c.createOscillator();
    const w2 = c.createOscillator();
    w1.type = 'sine';
    w2.type = 'sine';
    w1.frequency.value = 1396.9;
    w2.frequency.value = 1406.2;
    w1.connect(trem);
    w2.connect(trem);
    trem.connect(this.whineGain);
    this.whineGain.connect(this.bus);
    this.track(w1);
    this.track(w2);
    this.lfo(0.23, 0.4, trem.gain);
    this.lfo(5.2, 6, w1.frequency); // faint vibrato

    // ----- Wind / breath -----
    this.windGain = c.createGain();
    this.windGain.gain.value = 0.0001;
    const windSrc = c.createBufferSource();
    windSrc.buffer = this.noise;
    windSrc.loop = true;
    const windBp = c.createBiquadFilter();
    windBp.type = 'bandpass';
    windBp.frequency.value = 520;
    windBp.Q.value = 0.9;
    windSrc.connect(windBp);
    windBp.connect(this.windGain);
    this.windGain.connect(this.bus);
    this.track(windSrc);
    this.lfo(0.11, 260, windBp.frequency);

    this.applyLevel();
  }

  /* ------------------------------ public API ------------------------------ */

  /** Browsers start audio suspended until a user gesture. Call from a click. */
  resume(): void {
    if ('resume' in this.ctx && this.ctx.state === 'suspended') {
      (this.ctx as AudioContext).resume().catch(() => {});
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(muted ? 0.0001 : 0.9, t, muted ? 0.15 : 0.4);
    if (muted) this.stopScheduler();
    else this.startScheduler();
  }

  setGentle(gentle: boolean): void {
    this.gentle = gentle;
    this.applyLevel();
  }

  /** Haunting level, 0 to 100. */
  setLevel(level: number): void {
    this.level = Math.max(0, Math.min(100, level));
    this.applyLevel();
  }

  /** A short burst of static for glitch moments. */
  glitch(intensity = 0.5, t = this.ctx.currentTime): void {
    if (this.gentle) intensity *= 0.4;
    const dur = 0.07 + intensity * 0.16;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = rand(500, 3200);
    bp.Q.value = 1.4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.1 + intensity * 0.22, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.bus);
    src.start(t, rand(0, 1.5));
    src.stop(t + dur + 0.05);
  }

  /** A tiny keyboard tick. */
  keyTick(t = this.ctx.currentTime): void {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(rand(560, 760), t);
    g.gain.setValueAtTime(0.012, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    o.connect(g);
    g.connect(this.bus);
    o.start(t);
    o.stop(t + 0.035);
  }

  /** One lub-dub heartbeat. */
  heartbeat(t = this.ctx.currentTime, strength = 1): void {
    const thump = (at: number, freq: number, vol: number) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq, at);
      o.frequency.exponentialRampToValueAtTime(freq * 0.5, at + 0.16);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(vol * strength, at + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
      // a little click of body so small speakers hear it too
      const body = this.ctx.createOscillator();
      const bg = this.ctx.createGain();
      body.type = 'triangle';
      body.frequency.value = freq * 3.2;
      bg.gain.setValueAtTime(0.0001, at);
      bg.gain.exponentialRampToValueAtTime(vol * 0.35 * strength, at + 0.01);
      bg.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
      o.connect(g);
      body.connect(bg);
      g.connect(this.bus);
      bg.connect(this.bus);
      o.start(at);
      o.stop(at + 0.25);
      body.start(at);
      body.stop(at + 0.12);
    };
    thump(t, 62, 0.75);
    thump(t + 0.2, 52, 0.55);
  }

  /** A breathy, formant-shifting whisper, panned randomly. */
  whisper(t = this.ctx.currentTime): void {
    const syllables = Math.floor(rand(4, 8));
    const pan = this.ctx.createStereoPanner();
    pan.pan.value = rand(-0.85, 0.85);
    pan.connect(this.bus);
    let at = t;
    for (let i = 0; i < syllables; i++) {
      const dur = rand(0.07, 0.2);
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      const f1 = this.ctx.createBiquadFilter();
      f1.type = 'bandpass';
      f1.frequency.value = rand(500, 900);
      f1.Q.value = 6;
      const f2 = this.ctx.createBiquadFilter();
      f2.type = 'bandpass';
      f2.frequency.value = rand(1600, 3400);
      f2.Q.value = 7;
      const g = this.ctx.createGain();
      const peak = rand(0.1, 0.22) * (this.gentle ? 0.6 : 1);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(peak, at + dur * 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      src.connect(f1);
      src.connect(f2);
      f1.connect(g);
      f2.connect(g);
      g.connect(pan);
      src.start(at, rand(0, 1.8));
      src.stop(at + dur + 0.05);
      at += dur + rand(0.03, 0.13);
    }
  }

  /** A slow metallic creak, like a door or a bending pipe. */
  creak(t = this.ctx.currentTime): void {
    const dur = rand(1.0, 1.9);
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(rand(150, 230), t);
    o.frequency.exponentialRampToValueAtTime(rand(70, 110), t + dur);
    const vib = this.ctx.createOscillator();
    const vibG = this.ctx.createGain();
    vib.frequency.value = rand(9, 17);
    vibG.gain.value = 14;
    vib.connect(vibG);
    vibG.connect(o.frequency);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 11;
    bp.frequency.setValueAtTime(rand(380, 600), t);
    bp.frequency.exponentialRampToValueAtTime(rand(800, 1300), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.17, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(bp);
    bp.connect(g);
    g.connect(this.bus);
    o.start(t);
    vib.start(t);
    o.stop(t + dur + 0.05);
    vib.stop(t + dur + 0.05);
  }

  /** A slow, slightly out-of-tune music box in a minor key. */
  musicBox(t = this.ctx.currentTime): void {
    const scale = [659.25, 622.25, 523.25, 493.88, 392.0, 329.63];
    const notes = Math.floor(rand(4, 8));
    const detune = rand(-35, -12);
    let at = t;
    for (let i = 0; i < notes; i++) {
      const f = scale[Math.floor(Math.random() * scale.length)];
      const o = this.ctx.createOscillator();
      const o2 = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o2.type = 'triangle';
      o.frequency.value = f;
      o2.frequency.value = f * 2;
      o.detune.value = detune;
      o2.detune.value = detune * 1.4;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.1 * (this.gentle ? 0.6 : 1), at + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 1.7);
      o.connect(g);
      o2.connect(g);
      g.connect(this.bus);
      o.start(at);
      o2.start(at);
      o.stop(at + 1.8);
      o2.stop(at + 1.8);
      at += rand(0.32, 0.62);
    }
  }

  /** A loud swell and impact, used for the terminal crash. */
  stinger(t = this.ctx.currentTime): void {
    if (this.gentle) {
      this.glitch(0.8, t);
      return;
    }
    const dur = 1.6;
    // descending dissonant cluster
    [220, 233.08, 110].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 0.25, t + dur);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2600, t);
      lp.frequency.exponentialRampToValueAtTime(200, t + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.32 - i * 0.05, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(lp);
      lp.connect(g);
      g.connect(this.bus);
      o.start(t);
      o.stop(t + dur + 0.05);
    });
    // impact noise
    this.glitch(1.4, t);
    this.glitch(1.2, t + 0.09);
  }

  dispose(): void {
    this.disposed = true;
    this.stopScheduler();
    this.sources.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    });
    this.sources = [];
    if ('close' in this.ctx) (this.ctx as AudioContext).close().catch(() => {});
  }

  /* ------------------------------- internals ------------------------------ */

  private track(s: AudioScheduledSourceNode) {
    s.start(0);
    this.sources.push(s);
  }

  /** Add a low-frequency oscillator modulating an AudioParam. */
  private lfo(rate: number, depth: number, param: AudioParam) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.value = rate;
    g.gain.value = depth;
    o.connect(g);
    g.connect(param);
    this.track(o);
  }

  private applyLevel() {
    const t = this.ctx.currentTime;
    const L = this.level / 100;
    const calm = this.gentle ? 0.55 : 1;
    this.droneGain.gain.setTargetAtTime((0.1 + 0.22 * L) * calm, t, 0.5);
    this.windGain.gain.setTargetAtTime((0.015 + 0.07 * L) * calm, t, 0.6);
    // the whine only creeps in once things get uncomfortable
    const whine = L < 0.25 ? 0.0001 : (0.012 + 0.05 * ((L - 0.25) / 0.75) ** 1.5) * calm;
    this.whineGain.gain.setTargetAtTime(whine, t, 0.8);
    this.droneFilter.Q.setTargetAtTime(2 + 6 * L, t, 0.5);
  }

  private startScheduler() {
    if (this.timers.length || this.disposed) return;
    this.scheduleHeartbeat();
    this.scheduleEvent();
  }

  private stopScheduler() {
    this.timers.forEach((id) => window.clearTimeout(id));
    this.timers = [];
  }

  private later(fn: () => void, ms: number) {
    const id = window.setTimeout(() => {
      this.timers = this.timers.filter((x) => x !== id);
      if (!this.disposed && !this.muted) fn();
    }, ms);
    this.timers.push(id);
  }

  private scheduleHeartbeat() {
    const L = this.level;
    if (L >= 20) {
      this.heartbeat(this.ctx.currentTime + 0.02, 0.35 + (L / 100) * 0.8);
    }
    // 52 bpm when calm, up to about 130 bpm at full haunting
    const bpm = 52 + L * 0.78;
    this.later(() => this.scheduleHeartbeat(), 60000 / bpm);
  }

  private scheduleEvent() {
    const L = this.level;
    const t = this.ctx.currentTime + 0.05;
    const roll = Math.random();
    if (L >= 15 && roll < 0.42) this.whisper(t);
    else if (L >= 35 && roll < 0.68 && !this.gentle) this.creak(t);
    else if (L >= 45 && roll < 0.88) this.musicBox(t);
    else if (L >= 75 && !this.gentle) this.glitch(1, t);
    // calmer when low, much more frequent when high
    const gap = rand(5500, 11000) * (1 - 0.65 * (L / 100));
    this.later(() => this.scheduleEvent(), gap);
  }

  private makeNoise(seconds: number): AudioBuffer {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** A synthetic room impulse response: decaying stereo noise. */
  private makeImpulse(seconds: number, decay: number): AudioBuffer {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }
}
