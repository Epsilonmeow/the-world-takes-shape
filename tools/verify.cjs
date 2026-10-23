#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const file = path.resolve(ROOT, process.argv[2] || 'deliverables/industrial-motion-tech-demo.mp4');
const reportFile = file.replace(/\.[^.]+$/, '') + '.verify.json';

try {
  if (!fs.existsSync(file)) throw new Error(`Video does not exist: ${file}`);
  const info = spawnSync(FFMPEG, ['-hide_banner', '-i', file], { encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  if (info.error) throw info.error;
  const metadata = info.stderr;
  const durationMatch = metadata.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  const duration = durationMatch ? Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3]) : null;
  const videoLine = metadata.split(/\r?\n/).find(line => /Stream .*Video:/.test(line));
  if (!videoLine || duration === null) throw new Error(`Could not read video metadata:\n${metadata}`);
  const dimensions = videoLine.match(/\b(\d{2,5})x(\d{2,5})\b/);
  const fpsMatch = videoLine.match(/([\d.]+) fps/);
  const hasAudio = /Stream .*Audio:/.test(metadata);
  // Decode every frame. -xerror turns corrupt frames into a failing exit status.
  const decoded = spawnSync(FFMPEG, ['-hide_banner', '-v', 'error', '-xerror', '-i', file, '-map', '0:v:0', '-progress', 'pipe:1', '-nostats', '-f', 'null', '-'], { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024, timeout: 300000 });
  if (decoded.error) throw decoded.error;
  const frameMatches = [...decoded.stdout.matchAll(/^frame=(\d+)$/gm)];
  const frameCount = frameMatches.length ? Number(frameMatches.at(-1)[1]) : null;
  const renderReportPath = file.replace(/\.[^.]+$/, '') + '.render.json';
  const render = fs.existsSync(renderReportPath) ? JSON.parse(fs.readFileSync(renderReportPath, 'utf8')) : null;
  const checks = {
    fullDecode: decoded.status === 0 && !decoded.stderr.trim(),
    noAudio: !hasAudio,
    dimensions: !render || (Number(dimensions?.[1]) === render.options.width && Number(dimensions?.[2]) === render.options.height),
    fps: !render || Number(fpsMatch?.[1]) === render.options.fps,
    duration: !render || Math.abs(duration - render.encodedDuration) <= 0.02,
    frameCount: !render || frameCount === render.frameCount,
    renderSucceeded: !render || render.ok === true,
    bt709Tags: !render?.color || (/\bbt709\b/.test(videoLine) && /yuv420p\(tv[,)]/.test(videoLine)),
  };
  const report = { ok: Object.values(checks).every(Boolean), file, checkedAt: new Date().toISOString(), bytes: fs.statSync(file).size, width: Number(dimensions?.[1]), height: Number(dimensions?.[2]), fps: Number(fpsMatch?.[1]), duration, frameCount, hasAudio, checks, videoStream: videoLine.trim(), decoderStderr: decoded.stderr.trim(), note: 'This verifies encoding and deterministic export metadata. Artistic quality and visible motion require direct viewing.' };
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ok) process.exitCode = 1;
} catch (error) {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
}
