// Real headless-browser checks using embedded local files and blocked network.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { launch, openOffline } = require('./offline.cjs');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

// Chromium occasionally rounds a handful of anti-aliased edge pixels by 1–2
// levels between contexts or render histories. Keep exact hashes, and bound
// that numerical noise separately from actual image/animation differences.
async function comparePixels(page, first, second) {
  if (first === second) return { equal: true, equivalent: true, changedPixels: 0, changedFraction: 0, maxChannelDifference: 0, meanAbsoluteDifference: 0 };
  return page.evaluate(async ([first, second]) => {
    async function pixels(source) {
      const image = new Image(); image.src = source; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, canvas.width, canvas.height).data;
    }
    const a = await pixels(first), b = await pixels(second);
    if (a.length !== b.length) return { equal: false, equivalent: false, reason: 'Different image dimensions' };
    let changedPixels = 0, maxChannelDifference = 0, total = 0;
    for (let i = 0; i < a.length; i += 4) {
      let difference = 0;
      for (let channel = 0; channel < 4; channel++) {
        const delta = Math.abs(a[i + channel] - b[i + channel]);
        difference = Math.max(difference, delta); total += delta;
      }
      if (difference) changedPixels++;
      maxChannelDifference = Math.max(maxChannelDifference, difference);
    }
    const changedFraction = changedPixels / (a.length / 4);
    return { equal: false, equivalent: maxChannelDifference <= 2 && changedFraction <= .0005,
      changedPixels, changedFraction, maxChannelDifference, meanAbsoluteDifference: total / a.length };
  }, [first, second]);
}

async function main() {
  const review = path.resolve(__dirname, '../review');
  fs.mkdirSync(review, { recursive: true });
  const report = { started: new Date().toISOString(), imageComparison: { exactHashesRetained: true, allowedMaximumChannelDifference: 2, allowedChangedPixelFraction: .0005, reason: 'Bounded Chromium raster/rounding noise; larger or broader differences fail.' } };
  const browser = await launch();
  try {
    const page = await openOffline(browser, { player: true, width: 1920, height: 1200, report });
    await page.waitForFunction(() => player.state().audioReadyState >= 3, null, { timeout: 30000 });
    report.initial = await page.evaluate(() => player.state());
    await page.click('#play');
    await page.waitForTimeout(350);
    report.during = await page.evaluate(() => ({ state: player.state(), stats: demo.stats() }));
    await page.click('#play');
    report.paused = await page.evaluate(() => player.state());
    await page.waitForTimeout(200);
    report.stillPaused = await page.evaluate(() => player.state());
    await page.keyboard.press('ArrowRight');
    report.frameStep = await page.evaluate(() => player.state());
    await page.click('#mute');
    report.muted = await page.evaluate(() => player.state().muted);
    await page.evaluate(() => { player.seek(19.05); void player.play(); });
    await page.waitForFunction(() => !player.state().playing && player.state().time === 19.3, null, { timeout: 5000 });
    report.ended = await page.evaluate(() => player.state());
    await page.click('#reset');
    await page.waitForTimeout(150);
    report.replayed = await page.evaluate(() => player.state());
    await page.evaluate(() => { player.pause(); player.seek(7.5); });
    await page.screenshot({ path: path.join(review, 'desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(review, 'mobile.png'), fullPage: true });
    report.mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    await page.close();

    const renderPage = await openOffline(browser, { report });
    report.determinism = [];
    for (const t of [.8, 5.38, 8.2, 16.3, 17.1, 17.3, 17.8, 18.3, 18.8, 19.28]) {
      const pair = await renderPage.evaluate(t => { const canvas = document.getElementById('stage'); demo.render(t); const first = canvas.toDataURL(); demo.render(.2); demo.render(19.1); demo.render(t); return [first, canvas.toDataURL()]; }, t);
      report.determinism.push({ time: t, ...await comparePixels(renderPage, ...pair) });
    }
    report.renderSamples = await renderPage.evaluate(() => {
      const results = [];
      for (const t of [17.083, 17.1, 17.3, 17.55, 17.8, 18.05, 18.3, 18.55, 18.8, 19.05, 19.28]) {
        const start = performance.now(); demo.render(t); results.push({ time: t, drawMs: performance.now() - start, ...demo.stats() });
      }
      return results;
    });
    report.ok = report.errors.length === 0 && report.blockedRequests.length === 0
      && !report.initial.playing && report.initial.duration === 19.3
      && report.during.state.playing && report.during.state.time > 0
      && !report.paused.playing && report.paused.time === report.stillPaused.time
      && Math.abs(report.frameStep.time - report.paused.time - 1 / 60) < .001
      && report.muted && report.ended.time === 19.3 && !report.ended.playing
      && report.replayed.playing && report.replayed.time < 1 && !report.mobileOverflow
      && report.determinism.every(row => row.equivalent);
    report.completed = new Date().toISOString();
    fs.writeFileSync(path.join(review, 'check.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) throw new Error('One or more offline browser checks failed; see review/check.json');
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
