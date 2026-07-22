#!/usr/bin/env node
/**
 * Pre-renders 1200×630 Open Graph images into public/og/, one per stand
 * (named by campaign tag) plus default.png. Uses the Chromium from the
 * local puppeteer cache; needs `puppeteer-core` available (npx ok).
 *
 * Images deliberately carry NO live count — a static count goes stale
 * and stale numbers violate the honest-counts guardrail. The live count
 * belongs to the page itself.
 *
 * Keep scripts/og-stands.json in sync when stands change, then run:
 *   npm run og
 */
import { createRequire } from 'node:module';
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '../public/og');
mkdirSync(outDir, { recursive: true });

const stands = JSON.parse(readFileSync(join(here, 'og-stands.json'), 'utf8'));

const chromeRoot = join(homedir(), '.cache/puppeteer/chrome');
const ver = readdirSync(chromeRoot)[0];
const exe = join(chromeRoot, ver, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');

const browser = await puppeteer.launch({ executablePath: exe, headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await page.setContent(`<!doctype html><html><head>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@500;700;800&display=swap" rel="stylesheet">
  </head><body style="margin:0"><canvas id="c" width="1200" height="630"></canvas></body></html>`);
await page.evaluateHandle('document.fonts.ready');

async function draw(title, tag) {
  await page.evaluate(
    ({ title, tag }) => {
      const ctx = document.getElementById('c').getContext('2d');
      const W = 1200, H = 630;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0F2347');
      g.addColorStop(1, '#15305E');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      const chakra = (x, y, r, color, lw) => {
        ctx.save();
        ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = Math.max(1.2, lw * 0.6);
        for (let i = 0; i < 24; i++) {
          const a = (i * 15 * Math.PI) / 180;
          ctx.beginPath(); ctx.moveTo(x, y);
          ctx.lineTo(x + Math.sin(a) * r * 0.92, y - Math.cos(a) * r * 0.92); ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(x, y, r * 0.16, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      };

      ctx.save(); ctx.globalAlpha = 0.08; chakra(W - 120, H - 110, 200, '#FFFFFF', 4); ctx.restore();

      chakra(96, 96, 34, '#FFFFFF', 3.5);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '500 44px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Bharat', 152, 112);
      const rw = ctx.measureText('Bharat').width;
      ctx.font = '800 44px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Bol', 152 + rw + 5, 112);

      const y0 = 150;
      ctx.fillStyle = '#E2892C'; ctx.fillRect(64, y0, 74, 5);
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(142, y0, 74, 5);
      ctx.fillStyle = '#1E8A5B'; ctx.fillRect(220, y0, 74, 5);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '600 58px Fraunces, serif';
      const words = title.split(/\s+/);
      const lines = [];
      let line = '';
      for (const w of words) {
        const probe = line ? line + ' ' + w : w;
        if (ctx.measureText(probe).width > W - 128 && line) { lines.push(line); line = w; }
        else line = probe;
      }
      if (line) lines.push(line);
      let y = 260;
      for (const l of lines.slice(0, 4)) { ctx.fillText(l, 64, y); y += 72; }

      y += 16;
      ctx.fillStyle = '#E2892C';
      ctx.font = '600 40px Fraunces, serif';
      ctx.fillText('Bharat, bol. Add your voice.', 64, y);

      ctx.fillStyle = '#E2892C';
      ctx.font = '700 30px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('#BharatBol' + (tag ? ' #' + tag : ''), 64, H - 84);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = '400 22px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Verified engaged citizens · not a census · not an election', 64, H - 40);
    },
    { title, tag }
  );
  const el = await page.$('#c');
  return el.screenshot({ type: 'png' });
}

const { writeFileSync } = await import('node:fs');
for (const s of stands) {
  writeFileSync(join(outDir, `${s.tag}.png`), await draw(s.title, s.tag));
  console.log(`og/${s.tag}.png`);
}
writeFileSync(join(outDir, 'default.png'), await draw('Where Bharat speaks — stand on the issues that matter.', ''));
console.log('og/default.png');

await browser.close();
