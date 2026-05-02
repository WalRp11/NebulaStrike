const sfx = (() => {
  let _ctx = null;
  let muted = false;
  let masterGain = null;
  let compressor = null;
  let bgmGain = null;
  let bgmTimer = null;
  let bgmStep = 0;
  let bgmMode = 'play';
  /** 0..1 — drives BPM, percussion density, and brightness in level music */
  let bgmStress = 0;
  let ambientWave = 1;
  let ambientEndless = false;
  let ambientBoss = false;

  function getCtx() {
    if (!_ctx) {
      try {
        _ctx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = _ctx.createGain();
        masterGain.gain.value = 0.82;
        compressor = _ctx.createDynamicsCompressor();
        compressor.threshold.value = -22;
        compressor.knee.value = 14;
        compressor.ratio.value = 3.2;
        compressor.attack.value = 0.002;
        compressor.release.value = 0.28;
        masterGain.connect(compressor);
        compressor.connect(_ctx.destination);
        bgmGain = _ctx.createGain();
        bgmGain.gain.value = 0.0;
        bgmGain.connect(masterGain);
      } catch (e) {
        return null;
      }
    }
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
  }

  /**
   * @param {object} opts
   * @param {number} [opts.detuneSemis] second oscillator detune in semitones for width
   */
  function tone({
    freq = 440,
    type = 'square',
    duration = 0.1,
    volume = 0.3,
    freqEnd,
    attack = 0.005,
    dest,
    detuneSemis = 0,
    filterFreq = 0,
  }) {
    const ac = getCtx();
    if (!ac || muted) return;
    const t0 = ac.currentTime;
    const out = ac.createGain();
    out.gain.value = 0;
    const target = dest || masterGain;

    const mkOsc = (f, tp, det = 0) => {
      const o = ac.createOscillator();
      o.type = tp;
      o.frequency.setValueAtTime(f, t0);
      if (freqEnd !== undefined) {
        const ratio = freqEnd / freq;
        o.frequency.exponentialRampToValueAtTime(Math.max(f * ratio, 1), t0 + duration);
      }
      o.detune.value = det;
      return o;
    };

    const o1 = mkOsc(freq, type, 0);
    const g1 = ac.createGain();
    g1.gain.value = detuneSemis !== 0 ? 0.62 : 1;
    o1.connect(g1);
    g1.connect(out);

    if (detuneSemis !== 0) {
      const o2 = mkOsc(freq * Math.pow(2, detuneSemis / 12), type === 'square' ? 'triangle' : type, -5);
      const g2 = ac.createGain();
      g2.gain.value = 0.38;
      o2.connect(g2);
      g2.connect(out);
      o2.start(t0);
      o2.stop(t0 + duration + 0.03);
    }

    let node = out;
    if (filterFreq > 0) {
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(filterFreq, t0);
      lp.Q.value = 0.7;
      out.connect(lp);
      node = lp;
    }
    node.connect(target);

    out.gain.setValueAtTime(0.0001, t0);
    out.gain.linearRampToValueAtTime(volume, t0 + attack);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    o1.start(t0);
    o1.stop(t0 + duration + 0.03);
  }

  function noise({ duration = 0.2, volume = 0.3, lowpass = 1000, highpass }) {
    const ac = getCtx();
    if (!ac || muted) return;
    const bufSize = Math.floor(ac.sampleRate * duration);
    const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0,
      b1 = 0,
      b2 = 0;
    for (let i = 0; i < bufSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      data[i] = (b0 + b1 + b2 + white * 0.5362) * 0.11;
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    let node = src;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(lowpass, ac.currentTime);
    lp.frequency.exponentialRampToValueAtTime(120, ac.currentTime + duration);
    node.connect(lp);
    node = lp;
    if (highpass) {
      const hp = ac.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = highpass;
      lp.connect(hp);
      node = hp;
    }
    const gain = ac.createGain();
    gain.gain.setValueAtTime(volume, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
    node.connect(gain);
    gain.connect(masterGain);
    src.start();
    src.stop(ac.currentTime + duration + 0.02);
  }

  function hatClick(volume, stepDur) {
    const dur = Math.max(0.012, Math.min(0.055, stepDur * 0.42));
    noise({ duration: dur, volume: volume * 0.85, lowpass: 12000, highpass: 5500 });
  }

  function subPulse(freq, duration, volume) {
    const ac = getCtx();
    if (!ac || muted) return;
    const t0 = ac.currentTime;
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * 0.5, t0);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(volume, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration * 0.95);
    o.connect(g);
    g.connect(bgmGain);
    o.start(t0);
    o.stop(t0 + duration + 0.02);
  }

  const PATTERNS = {
    play: {
      bpm: 108,
      bass: [55, 0, 55, 0, 73, 0, 65, 0],
      arp: [220, 277, 330, 415, 277, 330, 415, 277],
      pad: 110,
    },
    boss: {
      bpm: 138,
      bass: [49, 49, 0, 49, 55, 0, 49, 0],
      arp: [196, 233, 261, 329, 392, 329, 261, 233],
      pad: 98,
    },
  };

  function computeStress() {
    const w = Math.max(1, ambientWave);
    if (ambientBoss) {
      return Math.min(1, w / 34 + 0.15);
    }
    if (ambientEndless) {
      return Math.min(1, (w - 1) / 36);
    }
    return w > 9 ? Math.min(0.42, (w - 9) / 22) : 0;
  }

  function bgmStepTick() {
    const ac = getCtx();
    if (!ac || muted) return;
    bgmStress = computeStress();
    const p = PATTERNS[bgmMode] || PATTERNS.play;
    const idx = bgmStep % p.bass.length;
    const bpm = p.bpm + bgmStress * (bgmMode === 'boss' ? 22 : 30);
    const stepDur = 60 / bpm / 2;

    const bf = p.bass[idx];
    if (bf) {
      tone({
        freq: bf,
        type: 'triangle',
        duration: stepDur * 0.92,
        volume: 0.14 + bgmStress * 0.05,
        dest: bgmGain,
        attack: 0.008,
        filterFreq: 2800 + bgmStress * 800,
      });
      subPulse(bf, stepDur * 0.9, 0.045 + bgmStress * 0.02);
    }

    const af = p.arp[idx];
    if (af) {
      tone({
        freq: af,
        type: 'square',
        duration: stepDur * 0.48,
        volume: 0.038 + bgmStress * 0.028,
        dest: bgmGain,
        attack: 0.004,
        detuneSemis: bgmStress > 0.35 ? 0.18 : 0,
        filterFreq: 6200 + bgmStress * 2000,
      });
    }

    if (idx % 8 === 0 && p.pad) {
      tone({
        freq: p.pad,
        type: 'sine',
        duration: stepDur * 7,
        volume: 0.035 + bgmStress * 0.02,
        dest: bgmGain,
        attack: 0.35,
      });
      tone({
        freq: p.pad * 1.5,
        type: 'sine',
        duration: stepDur * 7,
        volume: 0.026 + bgmStress * 0.015,
        dest: bgmGain,
        attack: 0.42,
      });
    }

    const hatVol = 0.018 + bgmStress * 0.07 + (bgmMode === 'boss' ? 0.025 : 0);
    if (idx % 2 === 1) {
      hatClick(hatVol, stepDur);
    } else if (bgmStress > 0.55 && idx % 4 === 0) {
      hatClick(hatVol * 0.65, stepDur);
    }

    if (bgmMode === 'boss' && idx % 2 === 0) {
      tone({ freq: 82, freqEnd: 38, type: 'sine', duration: 0.09, volume: 0.16 + bgmStress * 0.04, dest: bgmGain });
    }

    bgmStep++;
    bgmTimer = setTimeout(bgmStepTick, stepDur * 1000);
  }

  function startBgm(mode = 'play') {
    bgmMode = mode;
    const ac = getCtx();
    if (!ac || bgmTimer) return;
    bgmStep = 0;
    bgmGain.gain.cancelScheduledValues(ac.currentTime);
    bgmGain.gain.setValueAtTime(0.0001, ac.currentTime);
    bgmGain.gain.linearRampToValueAtTime(0.62, ac.currentTime + 1.15);
    bgmStepTick();
  }

  function stopBgm() {
    if (bgmTimer) {
      clearTimeout(bgmTimer);
      bgmTimer = null;
    }
    const ac = getCtx();
    if (ac && bgmGain) {
      bgmGain.gain.cancelScheduledValues(ac.currentTime);
      bgmGain.gain.linearRampToValueAtTime(0.0001, ac.currentTime + 0.42);
    }
  }

  function setBgmMode(mode) {
    if (mode !== bgmMode) bgmMode = mode;
  }

  function syncAmbientState(s) {
    if (!s) return;
    ambientWave = s.wave | 0;
    ambientEndless = !!s.endlessMode;
    ambientBoss = !!s.bossActive;
  }

  function bossClear() {
    [392, 494, 587, 698, 880].forEach((f, i) => {
      setTimeout(() => {
        tone({ freq: f, type: 'square', duration: 0.11, volume: 0.11 - i * 0.008, detuneSemis: 0.25, filterFreq: 9000 });
        tone({ freq: f * 2, type: 'triangle', duration: 0.08, volume: 0.045, attack: 0.002 });
      }, i * 72);
    });
  }

  function endlessDepth() {
    noise({ duration: 0.45, volume: 0.28, lowpass: 1800, highpass: 200 });
    [130, 98, 73].forEach((f, i) => {
      setTimeout(() => {
        tone({ freq: f, freqEnd: f * 0.5, type: 'sawtooth', duration: 0.55, volume: 0.18 - i * 0.04, filterFreq: 2400 });
      }, i * 90);
    });
    setTimeout(() => {
      [784, 988, 1175].forEach((f, j) => {
        setTimeout(() => tone({ freq: f, type: 'square', duration: 0.14, volume: 0.09, filterFreq: 7000 }), j * 65);
      });
    }, 200);
  }

  function campaignVictory() {
    [523, 659, 784, 1047, 1318, 1568].forEach((f, i) => {
      setTimeout(() => {
        tone({ freq: f, type: 'square', duration: 0.22, volume: 0.14, detuneSemis: 0.2, filterFreq: 10000 });
        tone({ freq: f * 1.5, type: 'sine', duration: 0.35, volume: 0.06, attack: 0.02 });
      }, i * 108);
    });
    setTimeout(() => noise({ duration: 0.5, volume: 0.15, lowpass: 4000 }), 400);
  }

  return {
    shoot(type = 'bullet') {
      if (type === 'beam') {
        tone({ freq: 1200, freqEnd: 620, type: 'sawtooth', duration: 0.045, volume: 0.055, filterFreq: 8000 });
        noise({ duration: 0.03, volume: 0.04, lowpass: 7000, highpass: 2000 });
      } else if (type === 'laser') {
        tone({ freq: 880, freqEnd: 220, type: 'sawtooth', duration: 0.11, volume: 0.12, filterFreq: 11000 });
        tone({ freq: 1760, freqEnd: 440, type: 'triangle', duration: 0.08, volume: 0.05 });
      } else if (type === 'rocket') {
        noise({ duration: 0.2, volume: 0.18, lowpass: 520 });
        tone({ freq: 140, freqEnd: 55, type: 'sawtooth', duration: 0.2, volume: 0.12 });
      } else {
        tone({ freq: 1020, freqEnd: 380, type: 'square', duration: 0.055, volume: 0.095, detuneSemis: 0.35, filterFreq: 11000 });
        tone({ freq: 2040, freqEnd: 900, type: 'triangle', duration: 0.038, volume: 0.048, attack: 0.001 });
      }
    },
    enemyExplode() {
      noise({ duration: 0.38, volume: 0.34, lowpass: 2400 });
      tone({ freq: 220, freqEnd: 45, type: 'sawtooth', duration: 0.28, volume: 0.14, filterFreq: 3500 });
      tone({ freq: 440, freqEnd: 80, type: 'square', duration: 0.12, volume: 0.06, attack: 0.01 });
    },
    bigExplode() {
      noise({ duration: 0.65, volume: 0.48, lowpass: 3200 });
      tone({ freq: 100, freqEnd: 28, type: 'sawtooth', duration: 0.52, volume: 0.24, filterFreq: 2800 });
    },
    meteorExplode() {
      noise({ duration: 0.24, volume: 0.26, lowpass: 650 });
      tone({ freq: 110, freqEnd: 35, type: 'sawtooth', duration: 0.2, volume: 0.11 });
    },
    playerHit() {
      noise({ duration: 0.2, volume: 0.32, lowpass: 900 });
      tone({ freq: 240, freqEnd: 70, type: 'square', duration: 0.2, volume: 0.26 });
      tone({ freq: 180, type: 'sine', duration: 0.35, volume: 0.08, attack: 0.02 });
    },
    weaponUpgrade() {
      [523, 659, 784, 1047].forEach((f, i) => {
        setTimeout(() => tone({ freq: f, type: 'square', duration: 0.13, volume: 0.14, filterFreq: 9000 }), i * 78);
      });
    },
    powerUp() {
      tone({ freq: 440, freqEnd: 990, type: 'sine', duration: 0.24, volume: 0.19 });
    },
    speedUp() {
      [660, 880, 1320].forEach((f, i) => {
        setTimeout(() => tone({ freq: f, type: 'sawtooth', duration: 0.1, volume: 0.12, filterFreq: 8000 }), i * 55);
      });
    },
    enemyShoot() {
      tone({ freq: 300, freqEnd: 160, type: 'sawtooth', duration: 0.075, volume: 0.065, filterFreq: 6000 });
    },
    bomb() {
      noise({ duration: 0.75, volume: 0.52, lowpass: 3200 });
      tone({ freq: 110, freqEnd: 22, type: 'sawtooth', duration: 0.65, volume: 0.32 });
      [72, 54, 36].forEach((f, i) => {
        setTimeout(() => tone({ freq: f, type: 'sine', duration: 0.35, volume: 0.18, attack: 0.02 }), i * 110);
      });
    },
    dash() {
      noise({ duration: 0.14, volume: 0.12, lowpass: 9000, highpass: 800 });
      tone({ freq: 1400, freqEnd: 380, type: 'sawtooth', duration: 0.16, volume: 0.13, filterFreq: 9000 });
    },
    charge() {
      const ac = getCtx();
      if (!ac || muted) return;
      const dur = CHARGE_FULL_MS / 1000;
      const t0 = ac.currentTime;
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(180, t0);
      o.frequency.exponentialRampToValueAtTime(1600, t0 + dur * 0.92);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.11, t0 + 0.06);
      g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2200, t0);
      lp.frequency.linearRampToValueAtTime(12000, t0 + dur);
      o.connect(lp);
      lp.connect(g);
      g.connect(masterGain);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    },
    chargedRelease() {
      noise({ duration: 0.32, volume: 0.2, lowpass: 5200 });
      tone({ freq: 1600, freqEnd: 180, type: 'sawtooth', duration: 0.42, volume: 0.26, filterFreq: 12000 });
    },
    comboUp(tier) {
      const f = 440 * Math.pow(1.18, tier);
      tone({ freq: f, type: 'square', duration: 0.1, volume: 0.13, filterFreq: 8000 });
      tone({ freq: f * 2.02, type: 'triangle', duration: 0.08, volume: 0.06 });
    },
    waveStart() {
      [330, 415, 523, 659].forEach((f, i) => {
        setTimeout(() => tone({ freq: f, type: 'square', duration: 0.16, volume: 0.13, filterFreq: 8500 }), i * 88);
      });
    },
    bossRoar() {
      noise({ duration: 0.95, volume: 0.42, lowpass: 900 });
      [115, 85, 68, 55].forEach((f, i) => {
        setTimeout(() => tone({ freq: f, freqEnd: f * 0.55, type: 'sawtooth', duration: 0.42, volume: 0.24, filterFreq: 2200 }), i * 115);
      });
    },
    pickup() {
      tone({ freq: 920, freqEnd: 1380, type: 'sine', duration: 0.14, volume: 0.17 });
      tone({ freq: 1840, type: 'triangle', duration: 0.08, volume: 0.05, attack: 0.005 });
    },
    gameOver() {
      [360, 280, 200, 130].forEach((f, i) => {
        setTimeout(() => tone({ freq: f, type: 'sawtooth', duration: 0.3, volume: 0.24, filterFreq: 4000 }), i * 195);
      });
    },
    victory: campaignVictory,
    bossClear,
    endlessDepth,
    campaignVictory,
    startBgm,
    stopBgm,
    setBgmMode,
    syncAmbientState,
    toggleMute() {
      muted = !muted;
      if (muted) stopBgm();
      return muted;
    },
    isMuted() {
      return muted;
    },
  };
})();
