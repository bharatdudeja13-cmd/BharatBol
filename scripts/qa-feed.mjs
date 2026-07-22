#!/usr/bin/env node
/**
 * Feed QA: drives both ingestion paths and the public surfaces in both
 * languages, capturing mobile screenshots. Fails on console errors.
 *
 *   npm run preview &
 *   node scripts/qa-feed.mjs <output-dir>
 */
import puppeteer from 'puppeteer-core';
import { readdirSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const out = process.argv[2] ?? '.';
mkdirSync(out, { recursive: true });

const chromeRoot = join(homedir(), '.cache/puppeteer/chrome');
const exe = join(
  chromeRoot,
  readdirSync(chromeRoot)[0],
  'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
);

const browser = await puppeteer.launch({ executablePath: exe, headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

const problems = [];
page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
page.on('pageerror', (e) => problems.push(`pageerror: ${e}`));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const base = 'http://localhost:4173';
const shot = (n) => page.screenshot({ path: join(out, `${n}.png`), fullPage: false });

async function setHindi(on) {
  await page.evaluate((want) => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      want ? b.textContent.trim() === 'हिं' : b.textContent.trim() === 'EN'
    );
    btn?.click();
  }, on);
  await sleep(500);
}

// ---- Public feed ----
await page.goto(`${base}/feed`, { waitUntil: 'networkidle0', timeout: 30000 });
await sleep(900);
await shot('feed-en');

// Filter by issue → loop-back card to the related Stand should appear.
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) =>
    x.textContent.includes('Education')
  );
  b?.click();
});
await sleep(600);
const hasLoop = await page.evaluate(() => !!document.querySelector('a[href^="/stand/"]'));
if (!hasLoop) problems.push('loop-back Stand link missing after issue filter');
await shot('feed-filtered');

// Report dialog.
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Report');
  b?.click();
});
await sleep(500);
await shot('feed-report');
await page.keyboard.press('Escape');
await page.evaluate(() => {
  const cancel = [...document.querySelectorAll('button')].find((x) =>
    x.textContent.includes('Not now')
  );
  cancel?.click();
});

await setHindi(true);
await shot('feed-hi');
await setHindi(false);

// ---- Path B: paste flow ----
await page.goto(`${base}/add`, { waitUntil: 'networkidle0' });
await sleep(600);
await shot('add-empty');
await page.type('input[type="url"]', 'https://youtu.be/aqz-KE-bpKQ?si=trackingtoken');
await sleep(700);
const detected = await page.evaluate(() =>
  (document.getElementById('root')?.innerText ?? '').includes('Detected')
);
if (!detected) problems.push('paste flow did not detect a supported URL');
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) =>
    x.textContent.includes('Education')
  );
  b?.click();
});
await sleep(400);
await page.evaluate(() => {
  const t = [...document.querySelectorAll('#map button, [role="option"]')].find(
    (x) => x.textContent.trim() === 'MH'
  );
  t?.click();
});
await sleep(400);
await shot('add-filled');

// ---- Path A: share-target hand-off ----
await page.goto(
  `${base}/add?title=Clip&text=look%20at%20this&url=${encodeURIComponent('https://x.com/example/status/1700000000000000000')}`,
  { waitUntil: 'networkidle0' }
);
await sleep(800);
const shareDetected = await page.evaluate(() =>
  (document.getElementById('root')?.innerText ?? '').includes('Detected')
);
if (!shareDetected) problems.push('share-target hand-off did not pre-fill the URL');
await shot('add-sharetarget');

// ---- Policy + moderation queue ----
await page.goto(`${base}/moderation`, { waitUntil: 'networkidle0' });
await sleep(500);
await shot('policy-en');
await setHindi(true);
await shot('policy-hi');
await setHindi(false);

await page.goto(`${base}/admin`, { waitUntil: 'networkidle0' });
await sleep(500);
await shot('admin');

console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'feed QA OK');
await browser.close();
process.exit(problems.length ? 1 : 0);
