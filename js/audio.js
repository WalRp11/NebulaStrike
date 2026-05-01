const sfx = (() => {
  let _ctx = null;
  let muted = false;
  let masterGain = null;
  let bgmGain = null;
  let bgmTimer = null;
  let bgmStep = 0;
  let bgmMode = 'menu';

  function getCtx() {
    if (!_ctx) {
      try {
        _ctx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = _ctx.createGain();
        masterGain.gain.value = 0.9;
        masterGain.connect(_ctx.destination);
        bgmGain = _ctx.createGain();
        bgmGain.gain.value = 0.0;
        bgmGain.connect(masterGain);
      } catch (e) { return null; }
    }
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
  }

  function tone({ freq = 440, type = 'square', duration = 0.1, volume = 0.3, freqEnd, attack = 0.005, dest }) {
    const ac = getCtx();
    if (!ac || muted) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(dest || masterGain);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    if (freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), ac.currentTime + duration);
    gain.gain.setValueAtTime(0.0001, ac.currentTime);
    gain.gain.linearRampToValueAtTime(volume, ac.currentTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + duration + 0.02);
  }

  function noise({ duration = 0.2, volume = 0.3, lowpass = 1000, highpass }) {
    const ac = getCtx();
    if (!ac || muted) return;
    const bufSize = Math.floor(ac.sampleRate * duration);
    const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    let node = src;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(lowpass, ac.currentTime);
    lp.frequency.exponentialRampToValueAtTime(50, ac.currentTime + duration);
    node.connect(lp); node = lp;
    if (highpass) {
      const hp = ac.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = highpass;
      node.connect(hp); node = hp;
    }
    const gain = ac.createGain();
    gain.gain.setValueAtTime(volume, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
    node.connect(gain);
    gain.connect(masterGain);
    src.start();
    src.stop(ac.currentTime + duration + 0.02);
  }

  const PATTERNS = {
    play: {
      bpm: 110,
      bass: [55, 0, 55, 0, 73, 0, 65, 0],
      arp: [220, 277, 330, 415, 277, 330, 415, 277],
      pad: 110,
    },
    boss: {
      bpm: 140,
      bass: [49, 49, 0, 49, 55, 0, 49, 0],
      arp: [196, 233, 261, 329, 392, 329, 261, 233],
      pad: 98,
    },
  };

  function bgmStepTick() {
    const ac = getCtx();
    if (!ac || muted) return;
    const p = PATTERNS[bgmMode] || PATTERNS.play;
    const idx = bgmStep % p.bass.length;
    const stepDur = 60 / p.bpm / 2;

    const bf = p.bass[idx];
    if (bf) tone({ freq: bf, type: 'triangle', duration: stepDur * 0.9, volume: 0.16, dest: bgmGain, attack: 0.01 });

    const af = p.arp[idx];
    if (af) tone({ freq: af, type: 'square', duration: stepDur * 0.45, volume: 0.045, dest: bgmGain, attack: 0.005 });

    if (idx % 8 === 0 && p.pad) {
      tone({ freq: p.pad, type: 'sine', duration: stepDur * 7, volume: 0.04, dest: bgmGain, attack: 0.4 });
      tone({ freq: p.pad * 1.5, type: 'sine', duration: stepDur * 7, volume: 0.03, dest: bgmGain, attack: 0.4 });
    }

    if (bgmMode === 'boss' && idx % 2 === 0) {
      tone({ freq: 80, freqEnd: 35, type: 'sine', duration: 0.08, volume: 0.18, dest: bgmGain });
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
    bgmGain.gain.linearRampToValueAtTime(0.6, ac.currentTime + 1.2);
    bgmStepTick();
  }

  function stopBgm() {
    if (bgmTimer) { clearTimeout(bgmTimer); bgmTimer = null; }
    const ac = getCtx();
    if (ac && bgmGain) {
      bgmGain.gain.cancelScheduledValues(ac.currentTime);
      bgmGain.gain.linearRampToValueAtTime(0.0001, ac.currentTime + 0.4);
    }
  }

  function setBgmMode(mode) {
    if (mode !== bgmMode) bgmMode = mode;
  }

  return {
    shoot(type = 'bullet') {
      if (type === 'beam') tone({ freq: 1100, freqEnd: 700, type: 'sawtooth', duration: 0.05, volume: 0.05 });
      else if (type === 'laser') tone({ freq: 800, freqEnd: 280, type: 'sawtooth', duration: 0.1, volume: 0.14 });
      else if (type === 'rocket') {
        noise({ duration: 0.18, volume: 0.16, lowpass: 400 });
        tone({ freq: 130, freqEnd: 60, type: 'sawtooth', duration: 0.18, volume: 0.1 });
      } else tone({ freq: 980, freqEnd: 420, type: 'square', duration: 0.06, volume: 0.11 });
    },
    enemyExplode() { noise({ duration: 0.35, volume: 0.32, lowpass: 900 }); tone({ freq: 200, freqEnd: 40, type: 'sawtooth', duration: 0.3, volume: 0.15 }); },
    bigExplode() { noise({ duration: 0.6, volume: 0.45, lowpass: 1200 }); tone({ freq: 110, freqEnd: 30, type: 'sawtooth', duration: 0.5, volume: 0.22 }); },
    meteorExplode() { noise({ duration: 0.22, volume: 0.24, lowpass: 500 }); tone({ freq: 100, freqEnd: 30, type: 'sawtooth', duration: 0.18, volume: 0.1 }); },
    playerHit() { noise({ duration: 0.18, volume: 0.28, lowpass: 700 }); tone({ freq: 220, freqEnd: 80, type: 'square', duration: 0.22, volume: 0.28 }); },
    weaponUpgrade() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone({ freq: f, type: 'square', duration: 0.14, volume: 0.16 }), i * 85)); },
    powerUp() { tone({ freq: 440, freqEnd: 880, type: 'sine', duration: 0.22, volume: 0.2 }); },
    speedUp() { [660, 880, 1320].forEach((f, i) => setTimeout(() => tone({ freq: f, type: 'sawtooth', duration: 0.1, volume: 0.13 }), i * 60)); },
    enemyShoot() { tone({ freq: 280, freqEnd: 180, type: 'sawtooth', duration: 0.08, volume: 0.05 }); },
    bomb() {
      noise({ duration: 0.7, volume: 0.5, lowpass: 1200 });
      tone({ freq: 120, freqEnd: 25, type: 'sawtooth', duration: 0.6, volume: 0.3 });
      [80, 60, 40].forEach((f, i) => setTimeout(() => tone({ freq: f, type: 'sine', duration: 0.3, volume: 0.2 }), i * 120));
    },
    dash() { tone({ freq: 1200, freqEnd: 400, type: 'sawtooth', duration: 0.15, volume: 0.14 }); noise({ duration: 0.12, volume: 0.1, lowpass: 2000, highpass: 600 }); },
    charge() { tone({ freq: 200, freqEnd: 1400, type: 'sawtooth', duration: CHARGE_FULL_MS / 1000, volume: 0.1, attack: 0.05 }); },
    chargedRelease() { tone({ freq: 1500, freqEnd: 200, type: 'sawtooth', duration: 0.4, volume: 0.25 }); noise({ duration: 0.3, volume: 0.18, lowpass: 1500 }); },
    comboUp(tier) { tone({ freq: 440 * Math.pow(1.18, tier), type: 'square', duration: 0.12, volume: 0.13 }); },
    waveStart() { [392, 523, 659, 784].forEach((f, i) => setTimeout(() => tone({ freq: f, type: 'square', duration: 0.18, volume: 0.15 }), i * 100)); },
    bossRoar() {
      noise({ duration: 0.9, volume: 0.4, lowpass: 600 });
      [120, 90, 70, 60].forEach((f, i) => setTimeout(() => tone({ freq: f, freqEnd: f * 0.6, type: 'sawtooth', duration: 0.4, volume: 0.25 }), i * 120));
    },
    pickup() { tone({ freq: 880, freqEnd: 1320, type: 'sine', duration: 0.15, volume: 0.16 }); },
    gameOver() { [380, 300, 220, 150].forEach((f, i) => setTimeout(() => tone({ freq: f, type: 'sawtooth', duration: 0.28, volume: 0.26 }), i * 210)); },
    victory() { [523, 659, 784, 1047, 1318].forEach((f, i) => setTimeout(() => tone({ freq: f, type: 'square', duration: 0.2, volume: 0.2 }), i * 120)); },
    startBgm,
    stopBgm,
    setBgmMode,
    toggleMute() { muted = !muted; if (muted) stopBgm(); return muted; },
    isMuted() { return muted; },
  };
})();
