#!/usr/bin/env node
'use strict';

// The browser and the export use the same deterministic demo.render(time) entry.
// Video frames are read synchronously from WebGL, then sent as raw RGBA to FFmpeg.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const CHROME = process.env.CHROME_PATH || undefined;
const SAMPLE_TIMES = [0.4, 1.6, 2.7, 3.4, 4.7, 6.3, 7.3, 8.8, 10.1, 11.6, 13.1, 14.2, 15.5, 17.0, 18.8, 20.5, 21.8];

function argumentsFor(argv) {
  const args = { mode: argv[0] || 'stills' };
  if (!['stills', 'video'].includes(args.mode)) throw new Error('Usage: node tools/render.cjs stills|video [--width N --height N --fps N --out PATH --from SEC --to SEC --url URL]');
  for (let i = 1; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    if (!['width', 'height', 'fps', 'out', 'from', 'to', 'url'].includes(key) || argv[i + 1] === undefined) throw new Error(`Unknown or incomplete option: ${argv[i]}`);
    args[key] = argv[i + 1];
  }
  for (const key of ['width', 'height', 'fps', 'from', 'to']) if (args[key] !== undefined) args[key] = Number(args[key]);
  args.width ??= args.mode === 'video' ? 1920 : 1280;
  args.height ??= args.mode === 'video' ? 1080 : 720;
  args.fps ??= 60;
  args.from ??= 0;
  args.url ??= 'http://127.0.0.1:5196/?export=1';
  for (const key of ['width', 'height', 'fps']) if (!Number.isInteger(args[key]) || args[key] <= 0) throw new Error(`${key} must be a positive integer`);
  if (args.width % 2 || args.height % 2) throw new Error('Width and height must be even for yuv420p output');
  if (!Number.isFinite(args.from) || args.from < 0 || (args.to !== undefined && !Number.isFinite(args.to))) throw new Error('Invalid time interval');
  args.out = path.resolve(ROOT, args.out || (args.mode === 'video' ? 'deliverables/industrial-motion-tech-demo.mp4' : 'renders'));
  return args;
}

function summarize(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return { count: values.length, mean: values.reduce((a, b) => a + b, 0) / values.length, p50: sorted[Math.floor(sorted.length * 0.5)], p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))], max: sorted.at(-1) };
}

async function main() {
  const opts = argumentsFor(process.argv.slice(2));
  let browser, encoder, receiver;
  let encoderStderr = '', expectedIndex = 0, encoderResult = null;
  const errors = [], warnings = [], frames = [];
  const started = performance.now();
  const report = { startedAt: new Date().toISOString(), options: opts, errors, warnings, frames };
  const reportPath = opts.mode === 'video' ? opts.out.replace(/\.[^.]+$/, '') + '.render.json' : path.join(opts.out, 'stills.render.json');
  fs.mkdirSync(opts.mode === 'video' ? path.dirname(opts.out) : opts.out, { recursive: true });
  const abort = () => { encoder?.kill(); browser?.close().catch(() => {}); receiver?.close(); };
  process.once('SIGINT', abort);
  process.once('SIGTERM', abort);
  try {
    browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--force-color-profile=srgb'] });
    const page = await browser.newPage({ viewport: { width: opts.width, height: opts.height }, deviceScaleFactor: 1 });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); else if (message.type() === 'warning') warnings.push(message.text()); });
    page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
    await page.goto(opts.url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction(() => window.demo?.ready === true, null, { timeout: 60000 });
    const duration = await page.evaluate(({ width, height }) => { window.demo.playing = false; window.demo.setSize(width, height); return window.demo.duration; }, opts);
    if (!Number.isFinite(duration) || duration <= 0) throw new Error(`Invalid demo duration: ${duration}`);
    opts.to ??= duration;
    if (opts.from >= opts.to || opts.to > duration + 0.000001) throw new Error(`Requested interval ${opts.from}–${opts.to} is outside duration ${duration}`);
    report.demoDuration = duration;
    report.browser = await browser.version();
    report.gpu = await page.evaluate(() => {
      const canvas = document.getElementById('stage');
      if (!canvas) throw new Error('Missing #stage canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) throw new Error('#stage does not have a WebGL context');
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      return { vendor: gl.getParameter(gl.VENDOR), renderer: gl.getParameter(gl.RENDERER), version: gl.getParameter(gl.VERSION), unmaskedVendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null, unmaskedRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null, canvasWidth: canvas.width, canvasHeight: canvas.height, maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE), contextAttributes: gl.getContextAttributes() };
    });
    if (report.gpu.canvasWidth !== opts.width || report.gpu.canvasHeight !== opts.height) throw new Error(`demo.setSize produced ${report.gpu.canvasWidth}×${report.gpu.canvasHeight}, expected ${opts.width}×${opts.height}`);
    if (opts.mode === 'stills') {
      const times = SAMPLE_TIMES.filter(time => time >= opts.from && time < opts.to);
      if (!times.length) times.push(opts.from);
      for (let i = 0; i < times.length; i++) {
        const time = times[i];
        const result = await page.evaluate(time => {
          const start = performance.now();
          window.demo.render(time);
          const drawMs = performance.now() - start;
          const data = document.getElementById('stage').toDataURL('image/png').split(',')[1];
          return { data, drawMs, totalMs: performance.now() - start, stats: window.demo.stats?.() ?? null };
        }, time);
        const filename = `${String(i + 1).padStart(2, '0')}-${time.toFixed(2).replace('.', '-')}.png`;
        fs.writeFileSync(path.join(opts.out, filename), Buffer.from(result.data, 'base64'));
        delete result.data;
        frames.push({ index: i, time, filename, ...result });
        process.stdout.write(`Still ${i + 1}/${times.length}: ${time.toFixed(2)}s\n`);
      }
    } else {
      const frameCount = Math.round((opts.to - opts.from) * opts.fps);
      if (frameCount < 1) throw new Error('Requested interval is shorter than one frame');
      const byteCount = opts.width * opts.height * 4;
      report.frameCount = frameCount;
      report.encodedDuration = frameCount / opts.fps;
      encoder = spawn(FFMPEG, ['-hide_banner', '-loglevel', 'warning', '-y', '-f', 'rawvideo', '-pixel_format', 'rgba', '-video_size', `${opts.width}x${opts.height}`, '-framerate', String(opts.fps), '-i', 'pipe:0', '-vf', 'vflip', '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', opts.out], { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
      const encoderExit = new Promise(resolve => {
        encoder.on('error', error => { encoderResult = { error: error.message }; resolve(encoderResult); });
        encoder.on('close', (code, signal) => { encoderResult = { code, signal }; resolve(encoderResult); });
      });
      encoder.stderr.on('data', chunk => { encoderStderr = (encoderStderr + chunk.toString()).slice(-20000); });
      encoder.stdin.on('error', error => { errors.push(`FFmpeg input: ${error.message}`); });
      receiver = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Allow-Private-Network', 'true');
        if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
        const url = new URL(req.url, 'http://127.0.0.1');
        if (req.method !== 'POST' || url.pathname !== '/frame' || Number(url.searchParams.get('index')) !== expectedIndex) { res.writeHead(400); res.end('Unexpected frame'); return; }
        const chunks = []; let length = 0;
        req.on('data', chunk => { length += chunk.length; if (length <= byteCount) chunks.push(chunk); else req.destroy(new Error('Frame exceeded expected byte count')); });
        req.on('error', error => { errors.push(`Frame receiver: ${error.message}`); if (!res.headersSent) res.writeHead(500); res.end(error.message); });
        req.on('end', () => {
          if (length !== byteCount) { res.writeHead(400); res.end(`Frame has ${length} bytes, expected ${byteCount}`); return; }
          if (encoderResult || encoder.stdin.destroyed) { res.writeHead(500); res.end(`FFmpeg exited: ${encoderStderr}`); return; }
          encoder.stdin.write(Buffer.concat(chunks, length), error => {
            if (error) { res.writeHead(500); res.end(error.message); return; }
            expectedIndex++;
            res.writeHead(200); res.end('ok');
          });
        });
      });
      await new Promise((resolve, reject) => { receiver.once('error', reject); receiver.listen(0, '127.0.0.1', resolve); });
      const frameUrl = `http://127.0.0.1:${receiver.address().port}/frame`;
      for (let index = 0; index < frameCount; index++) {
        if (encoderResult) throw new Error(`FFmpeg stopped early: ${JSON.stringify(encoderResult)} ${encoderStderr}`);
        const time = opts.from + index / opts.fps;
        const sample = await page.evaluate(async ({ time, index, frameUrl, width, height, collectStats }) => {
          const start = performance.now();
          window.demo.render(time);
          const drawMs = performance.now() - start;
          const canvas = document.getElementById('stage');
          const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
          window.__exportPixels ??= new Uint8Array(width * height * 4);
          gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, window.__exportPixels);
          const readMs = performance.now() - start - drawMs;
          const response = await fetch(`${frameUrl}?index=${index}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: window.__exportPixels });
          if (!response.ok) throw new Error(await response.text());
          return { drawMs, readMs, totalMs: performance.now() - start, stats: collectStats ? window.demo.stats?.() ?? null : undefined };
        }, { time, index, frameUrl, width: opts.width, height: opts.height, collectStats: index % opts.fps === 0 });
        frames.push({ index, time, ...sample });
        if ((index + 1) % opts.fps === 0 || index === frameCount - 1) process.stdout.write(`Frame ${index + 1}/${frameCount} (${((index + 1) / frameCount * 100).toFixed(1)}%), source ${time.toFixed(2)}s\n`);
      }
      encoder.stdin.end();
      const result = await encoderExit;
      if (result.code !== 0) throw new Error(`FFmpeg failed: ${JSON.stringify(result)}\n${encoderStderr}`);
      report.fileBytes = fs.statSync(opts.out).size;
    }
    report.ok = errors.length === 0;
    if (errors.length) throw new Error(`Browser/export reported ${errors.length} error(s): ${errors.join('\n')}`);
    process.stdout.write(`Finished: ${opts.out}\n`);
  } catch (error) {
    report.ok = false;
    report.failure = error.stack || String(error);
    throw error;
  } finally {
    report.wallSeconds = (performance.now() - started) / 1000;
    report.timingMs = { draw: summarize(frames.map(frame => frame.drawMs)), read: summarize(frames.map(frame => frame.readMs).filter(Number.isFinite)), total: summarize(frames.map(frame => frame.totalMs)) };
    report.encoderStderr = encoderStderr;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    process.stdout.write(`Report: ${reportPath}\n`);
    receiver?.closeAllConnections();
    receiver?.close();
    if (encoder && !encoderResult) encoder.kill();
    await browser?.close();
    process.removeListener('SIGINT', abort);
    process.removeListener('SIGTERM', abort);
  }
}

main().catch(error => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
