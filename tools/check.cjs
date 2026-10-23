#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'renders');
const URL = process.env.DEMO_URL || 'http://127.0.0.1:5196/';
const CHROME = process.env.CHROME_PATH || undefined;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const report = { checkedAt: new Date().toISOString(), url: URL, checks: [], errors: [], warnings: [], limitations: ['Playback is checked through time/state advancement and sampled frames, not continuous human viewing.', 'GPU timings and exact hashes apply to this local browser/GPU run.'] };
  let browser;
  const check = (name, passed, evidence) => { report.checks.push({ name, passed, evidence }); process.stdout.write(`${passed ? 'PASS' : 'FAIL'} ${name}\n`); };
  try {
    browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist', '--force-color-profile=srgb'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', msg => { if (msg.type() === 'error') report.errors.push(msg.text()); if (msg.type() === 'warning') report.warnings.push(msg.text()); });
    page.on('requestfailed', request => report.errors.push(`${request.url()}: ${request.failure()?.errorText}`));
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction(() => window.demo?.ready === true, null, { timeout: 60000 });
    const state = () => page.evaluate(() => ({ time: window.demo.stats().time, playing: window.demo.playing, label: document.getElementById('play').textContent, clock: document.getElementById('clock').textContent }));
    const seek = async time => { await page.locator('#seek').evaluate((input, value) => { input.value = String(value); input.dispatchEvent(new Event('input', { bubbles: true })); }, time); };
    const layout = () => page.evaluate(() => {
      const rect = document.getElementById('screen').getBoundingClientRect();
      const outside = [...document.querySelectorAll('#controls > *, .notes > *')].map(el => ({ tag: el.id || el.tagName, box: el.getBoundingClientRect() })).filter(({ box }) => box.left < -1 || box.right > innerWidth + 1).map(({ tag, box }) => ({ tag, left: box.left, right: box.right }));
      return { viewport: { width: innerWidth, height: innerHeight }, documentWidth: document.documentElement.scrollWidth, documentHeight: document.documentElement.scrollHeight, screen: { width: rect.width, height: rect.height, ratio: rect.width / rect.height }, overflowElements: outside };
    });

    let before = await state();
    await page.locator('#play').click();
    await page.waitForTimeout(1100);
    let after = await state();
    check('play advances time', after.playing && after.time - before.time >= 0.5, { before, after });
    await page.locator('#play').click();
    before = await state();
    await page.waitForTimeout(350);
    after = await state();
    check('pause holds time', !after.playing && Math.abs(after.time - before.time) < 1e-8 && after.label === '播放', { before, after });

    await seek(7.3);
    after = await state();
    check('range input seeks', !after.playing && Math.abs(after.time - 7.3) < 0.0001, after);
    await page.keyboard.press('ArrowRight');
    after = await state();
    check('right arrow advances one 60 fps frame', Math.abs(after.time - (7.3 + 1 / 60)) < 0.0001, after);
    await page.keyboard.press('ArrowLeft');
    after = await state();
    check('left arrow reverses one frame', Math.abs(after.time - 7.3) < 0.0001, after);
    await page.keyboard.press('Shift+ArrowRight');
    after = await state();
    check('shift-right advances one second', Math.abs(after.time - 8.3) < 0.0001, after);
    await page.locator('#reset').click();
    after = await state();
    check('replay resets and starts playback', after.playing && after.time >= 0 && after.time < 0.4, after);
    await page.keyboard.press('Space');
    after = await state();
    check('space toggles pause', !after.playing, after);

    await seek(9.15);
    let geometry = await layout();
    check('desktop layout fits viewport', geometry.documentWidth <= 1280 && geometry.documentHeight <= 900 && geometry.overflowElements.length === 0, geometry);
    check('desktop screen preserves 16:9', Math.abs(geometry.screen.ratio - 16 / 9) < 0.005, geometry.screen);
    await page.screenshot({ path: path.join(OUT, 'ui-desktop.png'), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(150);
    await seek(17.2);
    geometry = await layout();
    check('mobile layout fits viewport', geometry.documentWidth <= 390 && geometry.documentHeight <= 844 && geometry.overflowElements.length === 0, geometry);
    check('mobile screen preserves 16:9', Math.abs(geometry.screen.ratio - 16 / 9) < 0.005, geometry.screen);
    await page.screenshot({ path: path.join(OUT, 'ui-mobile.png'), fullPage: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(150);
    await page.evaluate(() => { window.demo.playing = false; window.demo.setSize(1280, 720); });
    async function pixelHash(time) {
      const base64 = await page.evaluate(time => {
        window.demo.render(time);
        const canvas = document.getElementById('stage');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        const bytes = new Uint8Array(canvas.width * canvas.height * 4);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
        let binary = '';
        for (let offset = 0; offset < bytes.length; offset += 32768) binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
        return btoa(binary);
      }, time);
      return crypto.createHash('sha256').update(Buffer.from(base64, 'base64')).digest('hex');
    }
    const hashA = await pixelHash(7.3), hashB = await pixelHash(17), hashC = await pixelHash(7.3);
    check('render is deterministic after scene/time jump', hashA === hashC && hashA !== hashB, { pixelFormat: 'full 1280×720 RGBA', samples: [{ time: 7.3, hash: hashA }, { time: 17, hash: hashB }, { time: 7.3, hash: hashC }] });

    const sheet = createCanvas(1440, 894), ctx = sheet.getContext('2d');
    ctx.fillStyle = '#080e15'; ctx.fillRect(0, 0, sheet.width, sheet.height);
    const times = [6.52, 6.6, 6.76, 8.25, 8.4, 8.56, 8.72, 8.9, 9.1];
    await page.evaluate(() => window.demo.setSize(960, 540));
    report.motionSheet = { file: 'motion-sheet.png', times, description: 'Nine sampled states around the 6.6 s cut and the 8.4 s camera turn.' };
    for (let i = 0; i < times.length; i++) {
      const data = await page.evaluate(time => { window.demo.render(time); return document.getElementById('stage').toDataURL('image/png').split(',')[1]; }, times[i]);
      const image = await loadImage(Buffer.from(data, 'base64'));
      const x = i % 3 * 480, y = Math.floor(i / 3) * 298;
      ctx.drawImage(image, x, y, 480, 270);
      ctx.fillStyle = '#ffb470'; ctx.font = '15px Segoe UI'; ctx.fillText(`${times[i].toFixed(2)} s`, x + 12, y + 290);
    }
    fs.writeFileSync(path.join(OUT, 'motion-sheet.png'), sheet.toBuffer('image/png'));
    check('no browser or asset errors', report.errors.length === 0, report.errors);
    report.ok = report.checks.every(item => item.passed);
  } catch (error) {
    report.ok = false;
    report.failure = error.stack || String(error);
    process.stderr.write(`${report.failure}\n`);
  } finally {
    fs.writeFileSync(path.join(OUT, 'playback-check.json'), JSON.stringify(report, null, 2));
    await browser?.close();
  }
  if (!report.ok) process.exitCode = 1;
}

main().catch(error => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
