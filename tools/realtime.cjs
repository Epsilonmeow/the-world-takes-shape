#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const OUTPUT = path.resolve(__dirname, '../renders/realtime-playback.json');

async function main() {
  let browser;
  const report = { checkedAt: new Date().toISOString(), errors: [], warnings: [], notes: ['One real browser playback, without still-frame capture.', 'requestAnimationFrame intervals measure observed browser scheduling, not a guarantee of isolated GPU throughput; concurrent export can affect them.'] };
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--force-color-profile=srgb'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', msg => { if (msg.type() === 'error') report.errors.push(msg.text()); if (msg.type() === 'warning') report.warnings.push(msg.text()); });
    page.on('requestfailed', request => report.errors.push(`${request.url()}: ${request.failure()?.errorText}`));
    await page.goto(process.env.DEMO_URL || 'http://127.0.0.1:5196/', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction(() => window.demo?.ready, null, { timeout: 60000 });
    report.playback = await page.evaluate(() => new Promise(resolve => {
      const start = performance.now(), intervals = [], stages = [], samples = [];
      let previousTimestamp = null, previousScene = null, previousSecond = -1;
      function sample(timestamp) {
        const stats = window.demo.stats(), elapsed = performance.now() - start;
        if (previousTimestamp !== null) intervals.push(timestamp - previousTimestamp);
        previousTimestamp = timestamp;
        if (stats.scene !== previousScene) { stages.push({ scene: stats.scene, time: stats.time, wallMs: elapsed }); previousScene = stats.scene; }
        if (Math.floor(stats.time) !== previousSecond) { samples.push({ time: stats.time, wallMs: elapsed, scene: stats.scene, playing: window.demo.playing }); previousSecond = Math.floor(stats.time); }
        if (stats.time >= window.demo.duration && !window.demo.playing) {
          const finalTime = stats.time, wallMs = elapsed;
          setTimeout(() => resolve({ reachedEnd: true, finalTime, wallMs, stopped: !window.demo.playing, holdsAtEnd: window.demo.stats().time === finalTime, frameIntervalsMs: intervals, stages, samples }), 350);
        } else if (elapsed > 35000) {
          window.demo.playing = false;
          resolve({ reachedEnd: false, finalTime: stats.time, wallMs: elapsed, stopped: false, holdsAtEnd: false, frameIntervalsMs: intervals, stages, samples });
        } else requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
      document.getElementById('play').click();
    }));
    const intervals = report.playback.frameIntervalsMs, sorted = [...intervals].sort((a,b) => a-b);
    report.scheduling = { observedFrames: intervals.length + 1, meanIntervalMs: intervals.reduce((a,b) => a+b,0) / intervals.length, p50IntervalMs: sorted[Math.floor(sorted.length * 0.5)], p95IntervalMs: sorted[Math.floor(sorted.length * 0.95)], maxIntervalMs: sorted.at(-1), intervalsOver33_4ms: intervals.filter(t => t > 33.4).length, intervalsOver50ms: intervals.filter(t => t > 50).length };
    report.scheduling.effectiveCallbackFps = 1000 / report.scheduling.meanIntervalMs;
    report.checks = { reachedEnd: report.playback.reachedEnd, stoppedAtEnd: report.playback.stopped, holdsAtEnd: report.playback.holdsAtEnd, allThreeScenes: ['machine','factory','network'].every(scene => report.playback.stages.some(stage => stage.scene === scene)), noErrors: report.errors.length === 0 };
    report.ok = Object.values(report.checks).every(Boolean);
    process.stdout.write(JSON.stringify({ ok: report.ok, checks: report.checks, scheduling: report.scheduling, stages: report.playback.stages, wallSeconds: report.playback.wallMs / 1000, errors: report.errors }, null, 2) + '\n');
  } catch (error) {
    report.ok = false; report.failure = error.stack || String(error); process.stderr.write(report.failure + '\n');
  } finally {
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    fs.writeFileSync(OUTPUT, JSON.stringify(report, null, 2));
    await browser?.close();
  }
  if (!report.ok) process.exitCode = 1;
}
main().catch(error => { process.stderr.write(String(error) + '\n'); process.exitCode = 1; });
