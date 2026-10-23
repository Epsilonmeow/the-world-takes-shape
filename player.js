const DURATION = 19.3;
const EXPORT = new URLSearchParams(location.search).has('export');
const $ = (id) => document.getElementById(id);
const ui = Object.fromEntries(['screen', 'loading', 'play', 'reset', 'mute', 'seek', 'clock', 'status'].map(id => [id, $(id)]));
const audio = new Audio();
audio.preload = EXPORT ? 'none' : 'auto';
if (!EXPORT) audio.src = './assets/centuries-19p3.wav';
let demo;
let ready = false;
let playing = false;
let pendingPlay = false;
let playGeneration = 0;
let raf = 0;
let time = 0;
let scrubbing = false;
let resumeAfterScrub = false;

const clamp = (value) => Math.max(0, Math.min(DURATION, Number(value) || 0));
function reflectPlaying(value) {
  playing = value;
  try { demo.playing = value; } catch { /* A renderer may expose a read-only playing property. */ }
  ui.play.textContent = value ? '暂停' : time >= DURATION ? '再播放' : '播放';
  ui.play.setAttribute('aria-label', value ? '暂停' : '播放');
}
function updateControls() {
  ui.seek.value = String(time);
  ui.seek.setAttribute('aria-valuetext', `${time.toFixed(2)} 秒，共 19.30 秒`);
  ui.clock.textContent = `${time.toFixed(2)} / 19.30`;
}
function render(value) {
  time = clamp(value);
  demo.render(time);
  updateControls();
}
function pause() {
  playGeneration++;
  pendingPlay = false;
  cancelAnimationFrame(raf);
  raf = 0;
  audio.pause();
  if (ready && playing) render(audio.currentTime);
  if (ready) reflectPlaying(false);
  ui.play.disabled = !ready;
}
function finish() {
  pause();
  audio.currentTime = DURATION;
  render(DURATION);
  reflectPlaying(false);
}
function tick() {
  if (!playing) return;
  if (audio.ended || audio.currentTime >= DURATION) {
    finish();
    return;
  }
  render(audio.currentTime);
  raf = requestAnimationFrame(tick);
}
async function play() {
  if (!ready || EXPORT || pendingPlay || playing) return;
  if (time >= DURATION - 1e-5) seek(0);
  const generation = ++playGeneration;
  pendingPlay = true;
  ui.play.disabled = true;
  ui.status.textContent = '';
  try {
    // Called directly by a user gesture; the audio is the only playback clock.
    audio.currentTime = time;
    await audio.play();
    if (generation !== playGeneration) {
      audio.pause();
      return;
    }
    reflectPlaying(true);
    tick();
  } catch (error) {
    reflectPlaying(false);
    ui.status.textContent = error.name === 'NotAllowedError'
      ? '浏览器未允许播放声音，请再按一次播放。'
      : '音频未能播放，请刷新页面后重试；仍可拖动时间条查看画面。';
  } finally {
    pendingPlay = false;
    ui.play.disabled = !ready;
  }
}
function seek(value) {
  if (!ready) return;
  const next = clamp(value);
  if (next >= DURATION) {
    finish();
    return;
  }
  audio.currentTime = next;
  render(next);
  if (!playing) reflectPlaying(false);
}
function toggle() { if (playing || pendingPlay) pause(); else void play(); }

window.player = {
  play, pause, seek,
  state: () => ({ ready, playing, pendingPlay, time, duration: DURATION, audioTime: audio.currentTime, muted: audio.muted, audioReadyState: audio.readyState, exportMode: EXPORT }),
};

if (!EXPORT) {
  ui.play.addEventListener('click', toggle);
  ui.reset.addEventListener('click', () => { pause(); seek(0); void play(); });
  ui.mute.addEventListener('click', () => {
    audio.muted = !audio.muted;
    ui.mute.textContent = audio.muted ? '开启声音' : '静音';
    ui.mute.setAttribute('aria-pressed', String(audio.muted));
  });
  ui.seek.addEventListener('pointerdown', () => {
    scrubbing = true;
    resumeAfterScrub = playing;
    pause();
  });
  ui.seek.addEventListener('input', () => seek(ui.seek.value));
  function finishScrub() {
    if (!scrubbing) return;
    scrubbing = false;
    const resume = resumeAfterScrub;
    resumeAfterScrub = false;
    if (resume && time < DURATION) void play();
  }
  ui.seek.addEventListener('change', finishScrub);
  window.addEventListener('pointerup', finishScrub);
  window.addEventListener('pointercancel', finishScrub);
  window.addEventListener('keydown', event => {
    if (!ready || event.altKey || event.ctrlKey || event.metaKey || event.target.isContentEditable) return;
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
    if (event.code === 'Space') {
      event.preventDefault();
      if (!event.repeat) toggle();
    } else if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
      event.preventDefault();
      pause();
      seek(time + (event.code === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 0.25 : 1 / 60));
    }
  });
  audio.addEventListener('ended', () => { if (ready) finish(); });
  audio.addEventListener('error', () => {
    if (ready) pause();
    ui.status.textContent = '音频载入失败。请刷新页面重试；仍可拖动时间条查看画面。';
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && playing) pause();
  });
}

async function initialize() {
  const started = performance.now();
  while (!window.demo || !window.demo.ready) {
    if (performance.now() - started > 30000) throw new Error('Renderer initialization timed out');
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  demo = window.demo;
  if (demo.ready && typeof demo.ready.then === 'function') await demo.ready;
  if (!EXPORT) {
    function resize() {
      const bounds = ui.screen.getBoundingClientRect();
      const scale = Math.min(window.devicePixelRatio || 1, 1.5);
      demo.setSize(Math.max(2, Math.round(bounds.width * scale)), Math.max(2, Math.round(bounds.height * scale)));
      render(playing ? audio.currentTime : time);
    }
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(ui.screen);
    for (const id of ['play', 'reset', 'mute', 'seek']) ui[id].disabled = false;
  }
  ready = true;
  reflectPlaying(false);
  render(0);
  ui.loading.hidden = true;
}
initialize().catch(error => {
  console.error('[Centuries player]', error);
  ui.loading.hidden = false;
  ui.loading.textContent = '画面未能载入，请刷新页面重试。';
});
