#!/usr/bin/env node
/**
 * Rasterizes the Ashoka-chakra app icon to PNG at the sizes Android needs.
 *
 * Why this exists: Chrome on Android will only offer "Install app" (i.e.
 * generate a WebAPK) when the manifest includes a real raster icon of at
 * least 192×192 — an SVG-only `icons` array passes validation everywhere
 * else (desktop Chrome/Edge, iOS "Add to Home Screen") but silently fails
 * the Android installability check, so the install option never appears.
 *
 * Run: node scripts/generate-icons.mjs
 * Uses the local puppeteer Chromium cache — no new npm install.
 */
import puppeteer from 'puppeteer-core';
import { readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '../public/icons');

const chromeRoot = join(homedir(), '.cache/puppeteer/chrome');
const exe = join(
  chromeRoot,
  readdirSync(chromeRoot)[0],
  'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
);

/** The 24-spoke Ashoka chakra, matching public/icons/icon.svg exactly. */
function chakraSpokes(cx, cy, len) {
  let s = '';
  for (let i = 0; i < 24; i++) {
    s += `<line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - len}" transform="rotate(${i * 15} ${cx} ${cy})"/>`;
  }
  return s;
}

/** purpose 'any': navy rounded-square, matches icon.svg. */
function svgAny() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#15305E"/>
  <g stroke="#FFFFFF" stroke-width="14" fill="none">
    <circle cx="256" cy="256" r="150"/>
    <g stroke-width="9">${chakraSpokes(256, 256, 138)}</g>
    <circle cx="256" cy="256" r="26" fill="#FFFFFF" stroke="none"/>
  </g>
</svg>`;
}

/** purpose 'maskable': smaller chakra with safe-zone padding, matches icon-maskable.svg. */
function svgMaskable() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#15305E"/>
  <g stroke="#FFFFFF" stroke-width="12" fill="none">
    <circle cx="256" cy="256" r="118"/>
    <g stroke-width="7">${chakraSpokes(256, 256, 108)}</g>
    <circle cx="256" cy="256" r="20" fill="#FFFFFF" stroke="none"/>
  </g>
</svg>`;
}

async function rasterize(page, svg, size) {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(
    `<!doctype html><html><body style="margin:0">${svg}</body></html>`,
    { waitUntil: 'load' }
  );
  await page.evaluate((s) => {
    const el = document.querySelector('svg');
    el.setAttribute('width', String(s));
    el.setAttribute('height', String(s));
  }, size);
  // omitBackground:true → transparent alpha outside painted shapes, so the
  // rounded-rect "any" icon doesn't get its corners flattened to black.
  return page.screenshot({ type: 'png', omitBackground: true });
}

const browser = await puppeteer.launch({ executablePath: exe, headless: 'new' });
const page = await browser.newPage();

const jobs = [
  ['icon-192.png', svgAny(), 192],
  ['icon-512.png', svgAny(), 512],
  ['icon-maskable-512.png', svgMaskable(), 512],
];

for (const [name, svg, size] of jobs) {
  const buf = await rasterize(page, svg, size);
  writeFileSync(join(outDir, name), buf);
  console.log(`icons/${name} (${size}×${size})`);
}

await browser.close();
