// tools/lib — shared plumbing for the command-line tools: static server, Chrome launcher, argument parsing.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.wav': 'audio/wav', '.png': 'image/png', '.jpg': 'image/jpeg', '.map': 'application/json' };

/** serve the project folder on localhost; port 0 = any free port */
export function serve(root = ROOT, port = 0) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let rel = decodeURIComponent(req.url.split('?')[0]);
      if (rel.endsWith('/')) rel += 'index.html';
      const file = path.join(root, rel);
      if (!file.startsWith(root)) {
        res.writeHead(403);
        res.end();
        return;
      }
      fs.readFile(file, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('not found');
          return;
        }
        res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
        res.end(data);
      });
    });
    server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port, url: `http://127.0.0.1:${server.address().port}` }));
  });
}

export function findChrome() {
  const cands = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ].filter(Boolean);
  for (const c of cands) if (fs.existsSync(c)) return c;
  throw new Error('Google Chrome not found — set CHROME_PATH');
}

/** open the film page headlessly and wait until it has booted. Returns { page, browser, url, close } */
export async function openFilm({ query = 'headless=1', quiet = false, pagePath = '/index.html' } = {}) {
  let puppeteer;
  try {
    puppeteer = (await import('puppeteer-core')).default;
  } catch {
    puppeteer = (await import('puppeteer')).default;
  }
  const srv = await serve();
  // software GL when there is no display/GPU (CI, containers); set PELICAN_GL=hardware to force the real GPU
  const software = process.env.PELICAN_GL ? process.env.PELICAN_GL === 'software' : process.platform === 'linux' && !process.env.DISPLAY;
  const args = ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars', '--force-color-profile=srgb', '--font-render-hinting=none', '--autoplay-policy=no-user-gesture-required', '--ignore-gpu-blocklist'];
  if (software) args.push('--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader');
  const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, args, protocolTimeout: 30 * 60 * 1000 });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  page.on('console', (m) => {
    const t = m.text();
    if (/GPU stall due to ReadPixels|GL Driver Message/.test(t)) return;
    if (!quiet || m.type() === 'error') console.log(`[page:${m.type()}] ${t}`);
  });
  page.on('pageerror', (e) => console.log('[pageerror] ' + (e.stack || e.message)));
  await page.goto(`${srv.url}${pagePath}${query ? '?' + query : ''}`, { waitUntil: 'load' });
  await page.waitForFunction('window.__ready !== undefined || window.__bootError', { timeout: 120000 });
  const ok = await page.evaluate(async () => {
    try {
      await window.__ready;
      return null;
    } catch (e) {
      return String((e && e.stack) || e);
    }
  });
  if (ok) {
    await browser.close();
    srv.server.close();
    throw new Error('page failed to boot: ' + ok);
  }
  const close = async () => {
    await browser.close();
    srv.server.close();
  };
  return { page, browser, url: srv.url, close };
}

/** --key value / --flag → { key: 'value', flag: true } */
export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || (next.startsWith('--') && isNaN(Number(next)))) out[k] = true;
      else {
        out[k] = next;
        i++;
      }
    } else out._.push(a);
  }
  return out;
}
export const nums = (s) => String(s).split(',').map((x) => Number(x.trim())).filter((x) => !Number.isNaN(x));

export function saveDataUrl(url, file) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
  return file;
}
