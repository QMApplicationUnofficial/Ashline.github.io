import { clamp } from './utils.js';

export class AudioManager {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.master = null;
    this.wind = null;
  }

  async resume() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.settings.values.volume;
      this.master.connect(this.ctx.destination);
      this.startWind();
    }
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  setVolume(value) {
    if (!this.master) return;
    this.master.gain.setTargetAtTime(clamp(value, 0, 1), this.ctx.currentTime, 0.02);
  }

  startWind() {
    if (!this.ctx || this.wind) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = (Math.random() * 2 - 1) * 0.45;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 330;
    filter.Q.value = 0.55;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.035;
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
    this.wind = { source, gain };
  }

  blip({ frequency = 440, duration = 0.08, type = 'sine', gain = 0.08, slide = 0 } = {}) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, frequency + slide), now + duration);
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(amp).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  noiseBurst({ duration = 0.12, gain = 0.08, lowpass = 1200, highpass = 70 } = {}) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const size = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / size);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = highpass;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = lowpass;
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(hp).connect(lp).connect(amp).connect(this.master);
    source.start(now);
  }

  shoot(kind = 'rifle') {
    const profiles = {
      rifle: { frequency: 92, slide: -40, noise: 0.17, lowpass: 2400 },
      smg: { frequency: 128, slide: -52, noise: 0.11, lowpass: 2100 },
      pistol: { frequency: 155, slide: -65, noise: 0.13, lowpass: 2600 },
      shotgun: { frequency: 72, slide: -38, noise: 0.24, lowpass: 1800 }
    };
    const p = profiles[kind] ?? profiles.rifle;
    this.blip({ frequency: p.frequency, duration: 0.08, type: 'sawtooth', gain: 0.12, slide: p.slide });
    this.noiseBurst({ duration: 0.1, gain: p.noise, lowpass: p.lowpass, highpass: 90 });
  }

  reload() {
    this.noiseBurst({ duration: 0.09, gain: 0.035, lowpass: 3600, highpass: 350 });
    window.setTimeout(() => this.blip({ frequency: 230, duration: 0.05, type: 'square', gain: 0.035 }), 120);
  }

  footstep(sprint = false) {
    this.noiseBurst({ duration: 0.055, gain: sprint ? 0.035 : 0.022, lowpass: 640, highpass: 90 });
  }

  impact() {
    this.noiseBurst({ duration: 0.07, gain: 0.045, lowpass: 1300, highpass: 160 });
  }

  beep(urgent = false) {
    this.blip({ frequency: urgent ? 880 : 610, duration: urgent ? 0.055 : 0.08, type: 'sine', gain: 0.05 });
  }

  round(won = true) {
    this.blip({ frequency: won ? 390 : 220, duration: 0.12, type: 'triangle', gain: 0.07, slide: won ? 220 : -70 });
    window.setTimeout(() => this.blip({ frequency: won ? 620 : 170, duration: 0.14, type: 'triangle', gain: 0.06 }), 130);
  }
}
