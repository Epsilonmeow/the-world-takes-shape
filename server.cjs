'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = fs.realpathSync(__dirname);
const port = Number(process.env.PORT || 5196);
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
};

function isInside(file) {
  const relative = path.relative(root, file);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}
function rangeFor(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2]) || size === 0) return null;
  let start, end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) return null;
    end = Math.min(end, size - 1);
  }
  return { start, end };
}
function end(res, code, body, headers = {}) {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
}

http.createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return end(res, 405, 'Method not allowed', { Allow: 'GET, HEAD' });
  let requested;
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    if (pathname.includes('\0')) return end(res, 400, 'Invalid path');
    requested = path.resolve(root, '.' + pathname);
    if (!isInside(requested)) return end(res, 403, 'Forbidden');
    if (requested === root) requested = path.join(root, 'index.html');
    let stat = await fs.promises.stat(requested);
    if (stat.isDirectory()) {
      requested = path.join(requested, 'index.html');
      stat = await fs.promises.stat(requested);
    }
    const file = await fs.promises.realpath(requested);
    if (!isInside(file)) return end(res, 403, 'Forbidden');
    if (!stat.isFile()) return end(res, 404, 'Not found');
    const headers = {
      'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Accept-Ranges': 'bytes',
      'X-Content-Type-Options': 'nosniff',
    };
    let range;
    if (req.headers.range) {
      range = rangeFor(req.headers.range, stat.size);
      if (!range) return end(res, 416, 'Range not satisfiable', { ...headers, 'Content-Range': `bytes */${stat.size}` });
      headers['Content-Range'] = `bytes ${range.start}-${range.end}/${stat.size}`;
      headers['Content-Length'] = range.end - range.start + 1;
    } else headers['Content-Length'] = stat.size;
    res.writeHead(range ? 206 : 200, headers);
    if (req.method === 'HEAD') return res.end();
    const stream = fs.createReadStream(file, range || undefined);
    stream.on('error', error => res.destroy(error));
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  } catch (error) {
    if (res.headersSent) return res.destroy(error);
    if (error instanceof URIError || error instanceof TypeError) return end(res, 400, 'Invalid path');
    end(res, error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 500, error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 'Not found' : 'Unable to read file');
  }
}).listen(port, '127.0.0.1', () => {
  process.stdout.write(`The World Takes Shape: http://127.0.0.1:${port}/\n`);
});
