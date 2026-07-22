#!/usr/bin/env node
/**
 * Headless smoke QA against a running preview server (default :4173):
 * drives the main surfaces, captures mobile screenshots, and fails on
 * any console error. Uses the Chromium from the local puppeteer cache.
 *
 *   npm run preview &   # serve dist
 *   node scripts/qa.mjs <output-dir> [--live]
 *
 * --live skips the demo join flow (it would bounce to Google OAuth).
 */
import puppeteer from 'puppeteer-core';
import { readdirSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const out = process.argv[2] ?? '.';
const live = process.argv.includes('--live');
mkdirSync(out, { recursive: true });

const chromeRoot = join(homedir(), '.cache/puppeteer/chrome');
const ver = readdirSync(chromeRoot)[0];
const exe = join(
  chromeRoot,
  ver,
  'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
);

const browser = await puppeteer.launch({ executablePath: exe, headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

const base = 'http://localhost:4173';
const shot = (name) => page.screenshot({ path: join(out, `${name}.png`) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto(base, { waitUntil: 'networkidle0', timeout: 30000 });
await sleep(800);
await shot('qa-home');

await page.goto(`${base}/stands`, { waitUntil: 'networkidle0' });
await shot('qa-stands');

// First stand's detail page.
const href = await page.evaluate(
  () => document.querySelector('a[href^="/stand/"]')?.getAttribute('href') ?? null
);
if (href) {
  await page.goto(`${base}${href}`, { waitUntil: 'networkidle0' });
  await shot('qa-detail');
  if (!live) {
    await page.evaluate(() =>
      [...document.querySelectorAll('button')]
        .find((x) => x.textContent.includes('I stand with this'))
        ?.click()
    );
    await sleep(2500);
    await shot('qa-share');
  }
}

await page.goto(`${base}/verify`, { waitUntil: 'networkidle0' });
await page.evaluate(() =>
  [...document.querySelectorAll('button')].find((x) => x.textContent.includes('recount'))?.click()
);
await sleep(2500);
await shot('qa-verify');

await page.goto(`${base}/about`, { waitUntil: 'networkidle0' });
await shot('qa-about');

console.log('CONSOLE ERRORS:', errors.length ? errors : 'none');
await browser.close();
process.exit(errors.length ? 1 : 0);
