// Deterministic local rendering: no HTTP server, website or user browser tab.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { launch, openOffline } = require('./offline.cjs');
const root = path.resolve(__dirname, '..'), fps = 60, duration = 19.3;
const flag = name => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
const from = Number(flag('--from') ?? 0), to = Number(flag('--to') ?? duration);
const width = Number(flag('--width') ?? 1920), height = Number(flag('--height') ?? 1080);
const stillTimes = [0, .8, 1.62, 3.31, 4.68, 5.38, 6.2, 8.2, 11.3, 13.5, 16.3, 17.083, 17.1, 17.3, 17.55, 17.8, 18.05, 18.3, 18.55, 18.8, 19.05, 19.28];

async function main() {
  if (!(from >= 0 && to <= duration && to > from)) throw new Error('--from/--to must describe an interval inside 0–19.3 seconds');
  if (![width, height].every(value => Number.isInteger(value) && value >= 2 && value % 2 === 0)) throw new Error('Output dimensions must be positive even integers');
  const frames = Math.round((to - from) * fps);
  const out = path.join(root, 'deliverables'), review = path.join(root, 'review'), stillsDir = path.join(review, 'frames');
  for (const dir of [out, stillsDir]) fs.mkdirSync(dir, { recursive: true });
  const report = { mode: process.argv.includes('--stills') ? 'stills' : 'video', from, to, width, height, fps, frames, duration: frames / fps, started: new Date().toISOString(), stills: [] };
  const browser = await launch();
  let encoder;
  try {
    const page = await openOffline(browser, { width, height, report });
    for (const t of stillTimes.filter(t => t >= from && t <= to)) {
      const frame = await page.evaluate(t => { demo.render(t); return { png: document.getElementById('stage').toDataURL('image/png').split(',')[1], stats: demo.stats() }; }, t);
      const file = path.join(stillsDir, `frame-${t.toFixed(2)}.png`);
      fs.writeFileSync(file, Buffer.from(frame.png, 'base64'));
      report.stills.push({ time: t, file, stats: frame.stats });
    }
    if (report.mode === 'stills') {
      report.completed = new Date().toISOString();
      fs.writeFileSync(path.join(review, 'stills.json'), JSON.stringify(report, null, 2));
      console.log(JSON.stringify(report, null, 2));
      if (report.errors.length || report.blockedRequests.length) throw new Error('Offline still rendering reported browser errors or attempted network requests');
      return;
    }
    const full = from === 0 && to === duration;
    const file = path.join(out, full ? 'centuries-first-19p3-seconds.mp4' : `centuries-${from.toFixed(2)}-to-${to.toFixed(2)}.mp4`);
    const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
    const args = ['-hide_banner', '-loglevel', 'warning', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-vcodec', 'png', '-i', 'pipe:0', '-ss', String(from), '-i', path.join(root, 'assets/centuries-19p3.wav'), '-map', '0:v:0', '-map', '1:a:0', '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv', '-c:a', 'aac', '-b:a', '320k', '-t', String(frames / fps), '-movflags', '+faststart', file];
    encoder = spawn(ffmpeg, args, { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
    let stderr = '';
    encoder.stderr.on('data', bytes => { stderr += bytes.toString(); });
    const done = new Promise((resolve, reject) => { encoder.on('error', reject); encoder.on('close', code => code === 0 ? resolve() : reject(new Error(`FFmpeg ${code}: ${stderr}`))); });
    // Handle encoder failures immediately even while the next frame is rendering.
    done.catch(() => {});
    for (let i = 0; i < frames; i++) {
      if (encoder.exitCode !== null) throw new Error(`FFmpeg stopped before frame ${i}: ${stderr}`);
      const png = await page.evaluate(t => { demo.render(t); return document.getElementById('stage').toDataURL('image/png').split(',')[1]; }, from + i / fps);
      if (!encoder.stdin.write(Buffer.from(png, 'base64'))) await once(encoder.stdin, 'drain');
      if (i % 60 === 0) console.log(`Rendered ${i}/${frames} frames`);
    }
    encoder.stdin.end();
    await done;
    report.output = file;
    report.bytes = fs.statSync(file).size;
    report.stderr = stderr;
    report.completed = new Date().toISOString();
    fs.writeFileSync(path.join(out, full ? 'render.json' : `render-${from.toFixed(2)}-to-${to.toFixed(2)}.json`), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    if (report.errors.length || report.blockedRequests.length) throw new Error('Offline video rendering reported browser errors or attempted network requests');
  } finally { encoder?.kill(); await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
