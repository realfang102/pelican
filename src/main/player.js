// main/player — the browser preview: transport bar, scrubber, section label and real-time Web Audio.
// The picture is always film.renderAt(T); the score is synthesised live by audio/engine.js and is the master clock
// while it is running, so picture and beat cannot drift apart.

export function startPlayer({ film, canvas, ctx, Beat }) {
  const $ = (id) => document.getElementById(id);
  const playBtn = $('play'), seek = $('seek'), timeEl = $('time'), labelEl = $('label'), veil = $('veil'), muteBtn = $('mute');
  const D = film.duration;
  seek.max = String(D);

  let T = 0, playing = false, muted = false, holding = false, dirty = true;
  let clock0 = 0, T0 = 0; // wall-clock fallback
  let engine = null, engineFailed = false;
  const now = () => performance.now() / 1000;

  // section ticks on the scrubber
  const ticks = $('ticks');
  for (let i = 1; i <= Beat.SECTIONS + 1; i++) {
    const el = document.createElement('i');
    el.style.left = `calc(${(Beat.sectionStart(i) / D) * 100}% )`;
    ticks.appendChild(el);
  }

  const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
  function showLabel() {
    const L = film.label(T);
    labelEl.innerHTML = `<b>${L.zh}</b><span>${L.n >= 1 && L.n <= 20 ? L.n + '. ' : ''}${L.en}</span>${L.date ? `<em>${L.date}</em>` : ''}`;
    timeEl.textContent = `${fmt(T)} / ${fmt(D)}`;
    if (document.activeElement !== seek || playing) seek.value = String(T);
  }

  async function getEngine() {
    if (engine || engineFailed) return engine;
    try {
      const mod = await import('../../audio/engine.js');
      engine = await mod.createEngine();
      engine.setMuted(muted);
    } catch (e) {
      engineFailed = true;
      console.warn('audio unavailable: ' + (e && e.message ? e.message : e));
    }
    return engine;
  }

  let starting = false; // true while the audio engine is being created / started: the picture waits for it
  async function startClock() {
    starting = true;
    try {
      const eng = await getEngine();
      if (!playing) return;
      if (eng) await eng.play(T);
      T0 = T;
      clock0 = now();
    } finally {
      starting = false;
    }
  }
  function stopClock() {
    if (engine) engine.stop();
  }
  const clockT = () => (engine && engine.playing ? engine.time() : T0 + (now() - clock0));

  async function play() {
    if (playing) return;
    if (T >= D - 0.02) T = 0;
    playing = true;
    playBtn.textContent = '❚❚';
    playBtn.setAttribute('aria-label', 'Pause');
    await startClock();
  }
  function pause() {
    if (!playing) return;
    T = Math.min(D, clockT());
    playing = false;
    stopClock();
    playBtn.textContent = '▶';
    playBtn.setAttribute('aria-label', 'Play');
    dirty = true;
  }
  async function seekTo(t) {
    T = Math.max(0, Math.min(D, t));
    dirty = true;
    if (playing) {
      stopClock();
      await startClock();
    }
  }

  playBtn.addEventListener('click', () => (playing ? pause() : play()));
  canvas.addEventListener('click', () => (playing ? pause() : play()));
  seek.addEventListener('input', () => seekTo(parseFloat(seek.value)));
  muteBtn.addEventListener('click', () => {
    muted = !muted;
    muteBtn.style.opacity = muted ? '0.4' : '1';
    if (engine) engine.setMuted(muted);
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      playing ? pause() : play();
    } else if (e.key === 'm') muteBtn.click();
    else if (e.key === 'ArrowRight') seekTo(T + (e.shiftKey ? 6 : 0.5));
    else if (e.key === 'ArrowLeft') seekTo(T - (e.shiftKey ? 6 : 0.5));
    else if (e.key === '.') seekTo(T + 1 / 60);
    else if (e.key === ',') seekTo(T - 1 / 60);
  });

  // paint the remaining scenes in the background, nearest first
  let loaded = 0;
  const total = film.scenes.length;
  (async () => {
    for (let i = 0; i < total; i++) {
      await film.ensure(i);
      loaded = i + 1;
      veil.querySelector('small').textContent = `${loaded} / ${total} pictures painted`;
      await new Promise((r) => setTimeout(r, 0));
    }
  })();

  function tick() {
    if (playing && !holding && !starting) {
      T = clockT();
      if (T >= D) {
        T = D;
        pause();
      }
      dirty = true;
    }
    if (dirty) {
      if (film.readyFor(T)) {
        film.renderAt(ctx, T);
        veil.classList.add('hidden');
        dirty = false;
        if (holding) {
          holding = false;
          if (playing) startClock();
        }
      } else {
        veil.classList.remove('hidden');
        veil.firstChild.textContent = 'Painting this era…';
        if (playing && !holding) {
          holding = true;
          stopClock();
        }
        film.prepare(T).then(() => (dirty = true));
      }
      showLabel();
    }
    requestAnimationFrame(tick);
  }
  showLabel();
  requestAnimationFrame(tick);
}
