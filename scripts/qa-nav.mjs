#!/usr/bin/env node
/**
 * Click-navigation QA: drives the app the way a user does — by clicking
 * internal links (push-state navigation), not direct URL loads. Fails if
 * any step renders an empty app shell or logs a console/page error.
 *
 *   npm run preview &
 *   node scripts/qa-nav.mjs <output-dir>
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

async function clickNav(selector, label) {
  const found = await page.evaluate((sel) => {
    const el = [...document.querySelectorAll(sel)][0];
    if (!el) return false;
    el.click();
    return true;
  }, selector);
  if (!found) {
    problems.push(`MISSING LINK: ${label} (${selector})`);
    return;
  }
  await sleep(1200);
  const { path, chars } = await page.evaluate(() => ({
    path: location.pathname,
    chars: (document.getElementById('root')?.innerText ?? '').trim().length,
  }));
  const blank = chars < 40; // an app shell always has header+footer text
  if (blank) problems.push(`BLANK PAGE after clicking ${label} → ${path} (${chars} chars)`);
  console.log(`${blank ? '✗ BLANK' : '✓'}  ${label} → ${path} (${chars} chars)`);
  await page.screenshot({ path: join(out, `nav-${label.replace(/[^a-z0-9]+/gi, '-')}.png`) });
}

await page.goto('http://localhost:4173/', { waitUntil: 'networkidle0', timeout: 30000 });
await sleep(800);

await clickNav('a[href^="/stand/"]', 'home-to-stand');
await clickNav('a[href="/stands"]', 'stand-to-stands');
await clickNav('a[href^="/stand/"]', 'stands-to-stand');
await clickNav('a[href="/verify"]', 'stand-to-verify');
await clickNav('a[href="/about"]', 'verify-to-about');
await clickNav('a[href="/"]', 'about-to-home');

// Repeat one navigation in Hindi.
await page.evaluate(() =>
  [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'हिं')?.click()
);
await sleep(600);
await clickNav('a[href^="/stand/"]', 'hi-home-to-stand');

console.log(problems.length ? `\nPROBLEMS:\n${problems.join('\n')}` : '\nall click-navigations OK');
await browser.close();
process.exit(problems.length ? 1 : 0);
