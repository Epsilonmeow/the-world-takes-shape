// Load this project's local ES modules into one network-blocked browser page.
// Each dependency gets one Blob URL, so shared Three.js code is never nested.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const workspace = path.resolve(__dirname, '..');
const fontFile = path.join(workspace, 'assets/Archivo.ttf');
const data = (mime, bytes) => `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;

function localPath(parent, reference) {
  const file = path.resolve(path.dirname(parent), reference);
  if (!file.startsWith(workspace + path.sep)) throw new Error(`Dependency outside project: ${file}`);
  return file;
}

function bundle(entries, { audio = false } = {}) {
  const modules = [], done = new Set(), visiting = new Set();
  const font = data('font/ttf', fs.readFileSync(fontFile));
  function visit(file) {
    file = path.resolve(file);
    if (done.has(file)) return;
    if (visiting.has(file)) throw new Error(`Circular imports are not supported by this offline exporter: ${file}`);
    visiting.add(file);
    let source = fs.readFileSync(file, 'utf8');
    source = source.replace(/url\((['"]?)([^)'"\r\n]+\.ttf)\1\)/g, (_all, _quote, reference) => {
      if (!reference.endsWith('assets/Archivo.ttf')) throw new Error(`Unexpected font: ${reference}`);
      return 'url(__OFFLINE_ARCHIVO_FONT__)';
    });
    if (audio && path.basename(file) === 'player.js') {
      source = source.replace(/(['"])(\.\/assets\/[^'"]+\.wav)\1/g, (_all, _quote, reference) => JSON.stringify(data('audio/wav', fs.readFileSync(localPath(file, reference)))));
    }
    const references = [];
    const patterns = [
      /(?:^|\n)\s*(?:import\s+(?:[\w*$,\s{}]+\s+from\s+)?|export\s+(?:\*(?:\s+as\s+\w+)?|\{[\w*$,\s]*\})\s+from\s+)(['"])([^'"\r\n]+)\1/g,
      /\bimport\s*\(\s*(['"])([^'"\r\n]+)\1\s*\)/g,
    ];
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        const specifier = match[2];
        if (!specifier.startsWith('.')) throw new Error(`Only relative local imports are allowed: ${specifier}`);
        const dependency = localPath(file, specifier);
        const offset = match.index + match[0].lastIndexOf(match[1] + specifier + match[1]) + 1;
        references.push({ start: offset, end: offset + specifier.length, dependency });
        visit(dependency);
      }
    }
    visiting.delete(file);
    done.add(file);
    modules.push({ file, source, references });
  }
  entries.forEach(visit);
  return { modules, entries: entries.map(file => path.resolve(file)), font };
}

async function launch() {
  return chromium.launch({
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
    headless: true,
    args: ['--enable-webgl', '--ignore-gpu-blocklist', '--force-color-profile=srgb', '--disable-background-networking', '--autoplay-policy=no-user-gesture-required'],
  });
}

async function openOffline(browser, { entry = path.join(workspace, 'src/main.js'), player = false, width = 1920, height = 1080, report = {} } = {}) {
  const base = workspace;
  const entries = [entry];
  if (player) entries.push(path.join(base, 'player.js'));
  const payload = bundle(entries, { audio: player });
  report.network = 'No website opened; all modules, font and audio embedded locally; browser network requests blocked.';
  report.errors ??= [];
  report.blockedRequests ??= [];
  report.moduleBundles ??= [];
  report.moduleBundles.push({ entry: path.relative(workspace, entry), modules: payload.modules.map(m => path.relative(workspace, m.file)), sourceBytes: payload.modules.reduce((sum, m) => sum + Buffer.byteLength(m.source), 0) });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.route('**/*', route => { report.blockedRequests.push(route.request().url().slice(0, 160)); return route.abort(); });
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  let html = '<!doctype html><html><body style="margin:0;background:#151917"><canvas id="stage" style="display:block;width:100vw;height:100vh"></canvas></body></html>';
  if (player) html = fs.readFileSync(path.join(base, 'index.html'), 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/url\((['"]?)[^)'"\r\n]+\.ttf\1\)/g, `url(${payload.font})`);
  await page.setContent(html);
  await page.evaluate(async ({ modules, entries, font }) => {
    const urls = new Map();
    for (const module of modules) {
      let source = module.source;
      for (const reference of [...module.references].sort((a, b) => b.start - a.start)) {
        const url = urls.get(reference.dependency);
        if (!url) throw new Error(`Missing embedded dependency: ${reference.dependency}`);
        source = source.slice(0, reference.start) + url + source.slice(reference.end);
      }
      source = source.replaceAll('__OFFLINE_ARCHIVO_FONT__', font);
      urls.set(module.file, URL.createObjectURL(new Blob([source], { type: 'text/javascript' })));
    }
    window.__offlineModuleUrls = [...urls.values()];
    for (const entry of entries) await import(urls.get(entry));
  }, payload);
  await page.waitForFunction(() => window.demo?.ready === true, null, { timeout: 60000 });
  if (player) await page.waitForFunction(() => window.player?.state().ready === true, null, { timeout: 30000 });
  else await page.evaluate(({ width, height }) => demo.setSize(width, height), { width, height });
  return page;
}

module.exports = { bundle, launch, openOffline, workspace };
