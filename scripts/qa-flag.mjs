#!/usr/bin/env node
/**
 * Flag QA: captures the hero flag mid-wave, the reduced-motion static
 * fallback, and a rough frame-rate sample of the animation.
 *
 *   npm run preview &
 *   node scripts/qa-flag.mjs <output-dir>
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shoot(label, { reduced = false, hindi = false } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle0', timeout: 30000 });
  if (hindi) {
    await page.evaluate(() =>
      [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'हिं')?.click()
    );
  }
  await sleep(1400);

  const flag = await page.$('.bb-flag');
  if (!flag) throw new Error('flag element not found');
  await flag.screenshot({ path: join(out, `flag-${label}.png`) });

  const info = await page.evaluate(() => {
    const el = document.querySelector('.bb-flag');
    const cloth = document.querySelector('.bb-flag-cloth');
    const still = document.querySelector('.bb-flag-still');
    const spin = document.querySelector('.bb-flag-chakra-spin');
    return {
      label: el?.getAttribute('aria-label'),
      role: el?.getAttribute('role'),
      cloth: getComputedStyle(cloth).display,
      clothAnimation: getComputedStyle(cloth).animationName,
      still: getComputedStyle(still).display,
      spinDuration: getComputedStyle(spin).animationDuration,
      focusable: !!document.querySelector('.bb-flag [tabindex], .bb-flag a, .bb-flag button'),
    };
  });
  console.log(label, JSON.stringify(info));
  await page.close();
}

await shoot('wave');
await shoot('reduced-motion', { reduced: true });
await shoot('hindi', { hindi: true });

// Frame-rate sample over ~2s of animation.
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle0' });
await sleep(600);
const fps = await page.evaluate(
  () =>
    new Promise((resolve) => {
      let frames = 0;
      const start = performance.now();
      const tick = () => {
        frames++;
        if (performance.now() - start < 2000) requestAnimationFrame(tick);
        else resolve(Math.round((frames / (performance.now() - start)) * 1000));
      };
      requestAnimationFrame(tick);
    })
);
console.log(`fps ~${fps}`);
await browser.close();
process.exit(fps < 45 ? 1 : 0);
