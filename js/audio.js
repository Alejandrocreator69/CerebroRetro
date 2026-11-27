/* =========================================================
   AUDIO · banda sonora synthwave original + efectos 8-bit
   Todo se genera en vivo con Web Audio: no hay archivos mp3.
   ========================================================= */
(function () {
  "use strict";

  var ctx = null, master, musicBus, sfxBus, delayIn, noiseBuf;
  var playing = false, timer = null, nextTime = 0, step = 0;
  var SPS = 60 / 100 / 4;                        // segundos por semicorchea (cambia con el estilo)
  var dl = null;                                 // delay del eco (su tiempo depende del estilo)

  function load(k, d) { try { var v = localStorage.getItem("brain." + k); return v === null ? d : v === "1"; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem("brain." + k, v ? "1" : "0"); } catch (e) {} }
  var musicOn = load("music", true), sfxOn = load("sfx", true);
  var style = "synthwave";
  try { style = localStorage.getItem("brain.style") || "synthwave"; } catch (e) {}

  function mtof(n) { return 440 * Math.pow(2, (n - 69) / 12); }

  function ensure() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return true; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = 0.85;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
    master.connect(comp); comp.connect(ctx.destination);

    musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? 0.5 : 0; sfxBus.connect(master);

    // Eco (delay con realimentación) para el arpegio y la melodía
    delayIn = ctx.createGain(); delayIn.gain.value = 1;
    dl = ctx.createDelay(1.5); dl.delayTime.value = SPS * 3;
    var fb = ctx.createGain(); fb.gain.value = 0.34;
    var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2200;
    var wet = ctx.createGain(); wet.gain.value = 0.45;
    delayIn.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(musicBus);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    document.addEventListener("visibilitychange", function () {
      if (!ctx) return;
      if (document.hidden) ctx.suspend(); else ctx.resume();
    });
    return true;
  }

  /* ---------- Instrumentos ---------- */
  function env(g, t, a, peak, dec, sus, rel, dur) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sus), t + a + dec);
    g.gain.setValueAtTime(Math.max(0.0001, peak * sus), t + Math.max(a + dec, dur));
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + dec, dur) + rel);
    return t + Math.max(a + dec, dur) + rel + 0.05;
  }

  function osc(type, f, t, end, dest, detune) {
    var o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (detune) o.detune.value = detune;
    o.connect(dest); o.start(t); o.stop(end); return o;
  }

  function bass(t, n, dur) {
    var g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = "lowpass"; f.Q.value = 6;
    f.frequency.setValueAtTime(260, t); f.frequency.exponentialRampToValueAtTime(1100, t + 0.03); f.frequency.exponentialRampToValueAtTime(320, t + dur);
    f.connect(g); g.connect(musicBus);
    var end = env(g, t, 0.005, 0.2, 0.12, 0.5, 0.05, dur * 0.8);
    osc("sawtooth", mtof(n), t, end, f); osc("square", mtof(n - 12), t, end, f);
  }

  function arp(t, n) {
    var g = ctx.createGain(); g.connect(musicBus); g.connect(delayIn);
    var end = env(g, t, 0.003, 0.045, 0.1, 0.2, 0.06, 0.05);
    osc("square", mtof(n), t, end, g);
  }

  function pad(t, notes, dur) {
    var f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 1300; f.Q.value = 1;
    var g = ctx.createGain(); f.connect(g); g.connect(musicBus);
    var end = env(g, t, 0.6, 0.05, 0.4, 0.8, 0.8, dur);
    notes.forEach(function (n) { osc("sawtooth", mtof(n), t, end, f, -8); osc("sawtooth", mtof(n), t, end, f, 8); });
  }

  function lead(t, n, dur) {
    var f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 2600;
    var g = ctx.createGain(); f.connect(g); g.connect(musicBus); g.connect(delayIn);
    var end = env(g, t, 0.02, 0.07, 0.15, 0.7, 0.18, dur);
    var lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.5; lg.gain.value = 9;
    lfo.connect(lg); lfo.start(t + 0.15); lfo.stop(end);
    var a = osc("sawtooth", mtof(n), t, end, f, -5), b = osc("square", mtof(n), t, end, f, 5);
    lg.connect(a.detune); lg.connect(b.detune);
  }

  function noise(t, dur, type, freq, gain, dest) {
    var s = ctx.createBufferSource(); s.buffer = noiseBuf;
    var f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    var g = ctx.createGain(); s.connect(f); f.connect(g); g.connect(dest || musicBus);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.start(t); s.stop(t + dur + 0.05);
  }

  function kick(t, gain) {
    var g = ctx.createGain(); g.connect(musicBus);
    var o = ctx.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(gain || 0.85, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    o.connect(g); o.start(t); o.stop(t + 0.4);
  }
  function snare(t) {
    noise(t, 0.12, "bandpass", 1900, 0.32);
    noise(t, 0.45, "highpass", 2500, 0.09);             // cola "gated" ochentera
    var g = ctx.createGain(); g.connect(musicBus);
    g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    osc("triangle", 185, t, t + 0.12, g);
  }
  function hat(t, open) { noise(t, open ? 0.14 : 0.035, "highpass", 7500, open ? 0.06 : 0.05); }

  /* ---------- Composición (original) ---------- */
  var ROOTS = [45, 41, 48, 43];                                   // Am · F · C · G
  var PADS = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]];
  var ARPS = [[69, 72, 76, 81], [65, 69, 72, 77], [67, 72, 76, 79], [67, 71, 74, 79]];
  var ARP_PAT = [0, 1, 2, 3, 2, 1, 0, 1, 0, 1, 2, 3, 2, 1, 2, 1];
  var BASS_PAT = [0, 0, 12, 0, 0, 12, 0, 12];
  var LEAD = [
    [[0, 76, 6], [6, 74, 2], [8, 72, 4], [12, 71, 4]],
    [[0, 69, 8], [8, 72, 4], [12, 77, 4]],
    [[0, 76, 6], [6, 77, 2], [8, 79, 6], [14, 76, 2]],
    [[0, 74, 12], [12, 71, 4]],
    [[0, 76, 4], [4, 81, 4], [8, 79, 4], [12, 76, 4]],
    [[0, 77, 6], [6, 76, 2], [8, 72, 8]],
    [[0, 72, 4], [4, 74, 4], [8, 76, 8]],
    [[0, 74, 8], [8, 71, 8]]
  ];

  function schedule(st, t) {
    var bar = Math.floor(st / 16), s = st % 16, ch = bar % 4, sec = Math.floor(bar / 8);
    if (s === 0) pad(t, PADS[ch], 16 * SPS);
    if (s % 2 === 0) bass(t, ROOTS[ch] + BASS_PAT[s / 2], SPS * 2);
    if (sec > 0 || bar >= 4) arp(t, ARPS[ch][ARP_PAT[s]]);
    if (sec === 1 || sec === 2) {
      if (s === 0 || s === 8) kick(t);
      if (s === 4 || s === 12) snare(t);
      if (s % 2 === 0) hat(t, s % 4 === 2);
    } else if (sec === 0 && bar >= 4) {
      if (s % 4 === 2) hat(t, false);
    } else if (sec === 3) {
      if (s === 0) kick(t);
      if (s === 12) snare(t);
    }
    if (sec >= 2) {
      LEAD[bar % 8].forEach(function (ev) { if (ev[0] === s) lead(t, ev[1], ev[2] * SPS); });
    }
  }

  /* Nota genérica: onda, nota MIDI, duración, volumen, ataque, cola, filtro y envío al eco */
  function tone(t, type, n, dur, peak, a, rel, cutoff, toDelay) {
    var g = ctx.createGain(), dest = g;
    if (cutoff) { var f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = cutoff; f.connect(g); dest = f; }
    g.connect(musicBus); if (toDelay) g.connect(delayIn);
    var end = env(g, t, a, peak, 0.08, 0.7, rel, dur);
    osc(type, mtof(n), t, end, dest);
  }

  /* ---------- Estilo 2: Espacial (ambiente, 76 BPM) ---------- */
  var SP_ROOTS = [50, 46, 53, 48];                                  // Dm · Bb · F · C
  var SP_CH = [[62, 65, 69, 72], [58, 62, 65, 69], [60, 65, 69, 72], [60, 64, 67, 74]];
  var SP_PAT = [0, 2, 1, 3, 2, 0, 3, 1];
  function scheduleSpace(st, t) {
    var bar = Math.floor(st / 16), s = st % 16, ch = Math.floor(bar / 2) % 4, c = SP_CH[ch];
    if (s === 0 && bar % 2 === 0) {
      tone(t, "sawtooth", SP_ROOTS[ch] - 12, 30 * SPS, 0.06, 2.5, 3, 480);
      tone(t, "sine", SP_ROOTS[ch], 30 * SPS, 0.07, 2, 3, 0);
      c.forEach(function (n) { tone(t + 0.05, "triangle", n, 28 * SPS, 0.02, 3, 3, 1400); });
    }
    if (s % 2 === 0) tone(t, "triangle", c[SP_PAT[(s / 2) % 8]] + (bar % 2 ? 12 : 0), SPS, 0.035, 0.005, 0.5, 2600, true);
    if (s === 0 || s === 8) kick(t, 0.35);
    if ((st * 37) % 29 === 3) tone(t, "sine", c[st % 4] + 24, SPS * 0.5, 0.025, 0.003, 1.4, 0, true);
  }

  /* ---------- Estilo 3: Chiptune (8 bits, 150 BPM) ---------- */
  var CH_MEL = [69, 0, 72, 0, 76, 0, 74, 72, 69, 0, 67, 0, 69, 0, 0, 0,
                65, 0, 69, 0, 72, 0, 74, 0, 72, 0, 69, 0, 67, 0, 65, 0,
                64, 0, 67, 0, 72, 0, 76, 0, 79, 0, 76, 0, 74, 0, 72, 0,
                71, 0, 74, 0, 79, 0, 77, 76, 74, 0, 71, 0, 67, 0, 0, 0];
  var CH_BASS = [45, 41, 48, 43];
  var CH_CHORD = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
  function scheduleChip(st, t) {
    var pos = st % 64, bar = Math.floor(pos / 16), s = pos % 16, intro = st < 64;
    if (!intro && CH_MEL[pos]) tone(t, "square", CH_MEL[pos], SPS * 1.5, 0.05, 0.004, 0.05, 3000, true);
    tone(t, "square", CH_CHORD[bar][s % 3] + 12, SPS * 0.5, intro ? 0.03 : 0.014, 0.002, 0.03, 2200);
    if (s % 2 === 0) tone(t, "triangle", CH_BASS[bar] - 12 + ((s / 2) % 2 ? 12 : 0), SPS * 1.6, 0.22, 0.004, 0.04, 0);
    if (s % 4 === 0) kick(t, 0.6);
    if (s === 4 || s === 12) noise(t, 0.1, "bandpass", 2200, 0.2);
    if (s % 2 === 1) noise(t, 0.03, "highpass", 8000, 0.045);
  }

  var STYLES = {
    synthwave: { name: "SYNTHWAVE", bpm: 100, loop: 32 * 16, fn: schedule },
    space:     { name: "ESPACIAL",  bpm: 76,  loop: 8 * 16,  fn: scheduleSpace },
    chiptune:  { name: "CHIPTUNE",  bpm: 150, loop: 8 * 16,  fn: scheduleChip }
  };
  if (!STYLES[style]) style = "synthwave";
  SPS = 60 / STYLES[style].bpm / 4;

  function tick() {
    if (!ctx || !playing) return;
    if (nextTime < ctx.currentTime - 0.2) nextTime = ctx.currentTime + 0.05;  // pestaña dormida: no "ráfagas"
    var S = STYLES[style];
    while (nextTime < ctx.currentTime + 0.15) {
      S.fn(step, nextTime);
      nextTime += SPS; step = (step + 1) % S.loop;
    }
  }

  var switching = null;
  function setStyle(id) {
    if (!STYLES[id]) return;
    try { localStorage.setItem("brain.style", id); } catch (e) {}
    var apply = function () {
      style = id; SPS = 60 / STYLES[id].bpm / 4; step = 0;
      if (dl) dl.delayTime.setValueAtTime(SPS * 3, ctx.currentTime);
      if (ctx) nextTime = ctx.currentTime + 0.05;
    };
    if (!musicOn) { musicOn = true; save("music", true); }
    if (!ensure()) { style = id; SPS = 60 / STYLES[id].bpm / 4; return; }
    clearTimeout(switching);
    if (playing && id !== style) {
      fadeMusic(0, 0.4);
      switching = setTimeout(function () { apply(); fadeMusic(0.55, 1.2); }, 450);
    } else {
      if (!playing) apply();
      startMusic();
    }
  }

  function fadeMusic(to, time) {
    if (!ctx) return;
    var now = ctx.currentTime;
    musicBus.gain.cancelScheduledValues(now);
    musicBus.gain.setValueAtTime(musicBus.gain.value, now);
    musicBus.gain.linearRampToValueAtTime(to, now + time);
  }

  function startMusic() {
    if (!musicOn || !ensure()) return;
    fadeMusic(0.55, 2.5);
    if (playing) return;
    playing = true; step = 0; nextTime = ctx.currentTime + 0.08;
    timer = setInterval(tick, 25); tick();
  }
  function stopMusic() {
    if (!ctx || !playing) return;
    fadeMusic(0, 0.6);
    setTimeout(function () { if (!musicOn) { playing = false; clearInterval(timer); } }, 700);
  }

  /* ---------- Efectos de sonido ---------- */
  function sweep(type, f0, f1, dur, gain, t) {
    var g = ctx.createGain(); g.connect(sfxBus);
    var o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); o.start(t); o.stop(t + dur + 0.02);
  }
  function note(type, f, t, dur, gain) { sweep(type, f, f, dur, gain, t); }

  var SFX = {
    blip: function (t) { sweep("square", 880, 1320, 0.05, 0.05, t); },
    select: function (t) { note("square", 660, t, 0.06, 0.08); note("square", 990, t + 0.06, 0.1, 0.08); },
    back: function (t) { note("square", 660, t, 0.06, 0.07); note("square", 440, t + 0.06, 0.1, 0.07); },
    coin: function (t) { note("square", 988, t, 0.08, 0.1); note("square", 1319, t + 0.08, 0.4, 0.1); },
    power: function (t) { [523, 659, 784, 1047, 1319, 1568].forEach(function (f, i) { note("square", f, t + i * 0.055, 0.09, 0.07); }); },
    zap: function (t) { sweep("sawtooth", 1400, 90, 0.5, 0.07, t); noise(t, 0.3, "bandpass", 3000, 0.08, sfxBus); },
    buzz: function (t) { sweep("square", 130, 70, 0.35, 0.1, t); },
    calm: function (t) { [784, 988, 1175].forEach(function (f, i) { note("triangle", f, t + i * 0.07, 0.35, 0.08); }); },
    tick: function (t) { note("square", 440, t, 0.05, 0.06); },
    boot: function (t) { sweep("square", 220, 880, 0.25, 0.05, t); }
  };

  window.__AUDIO__ = {
    unlock: function () { ensure(); },
    startMusic: startMusic,
    toggleMusic: function () {
      musicOn = !musicOn; save("music", musicOn);
      if (musicOn) startMusic(); else stopMusic();
      return musicOn;
    },
    toggleSfx: function () {
      sfxOn = !sfxOn; save("sfx", sfxOn);
      if (ensure()) sfxBus.gain.value = sfxOn ? 0.5 : 0;
      return sfxOn;
    },
    isMusicOn: function () { return musicOn; },
    setStyle: setStyle,
    getStyle: function () { return style; },
    styles: function () { return Object.keys(STYLES).map(function (k) { return { id: k, name: STYLES[k].name }; }); },
    setMusicOff: function () { if (musicOn) { musicOn = false; save("music", false); stopMusic(); } },
    isSfxOn: function () { return sfxOn; },
    sfx: function (name) {
      if (!sfxOn || !SFX[name] || !ensure()) return;
      try { SFX[name](ctx.currentTime + 0.01); } catch (e) {}
    }
  };
})();
