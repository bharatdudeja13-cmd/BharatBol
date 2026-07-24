// Canvas rendering for the BharatBol proof card and citizen card.
// Two formats: 'portrait' 1080×1350 (4:5, feed) and 'story' 1080×1920
// (9:16, Instagram/WhatsApp status). Drawn entirely client-side;
// nothing is uploaded anywhere.
import { fmt } from './format';
import { BRAND } from '../config/brand';

export type CardFormat = 'portrait' | 'story';

const DIMS: Record<CardFormat, { w: number; h: number }> = {
  portrait: { w: 1080, h: 1350 },
  story: { w: 1080, h: 1920 },
};

const HONEST_LINE = 'Verified engaged citizens · not a census · not an election';

function drawChakra(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, width = 3) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = Math.max(1.5, width * 0.6);
  for (let i = 0; i < 24; i++) {
    const a = (i * 15 * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.sin(a) * r * 0.92, y - Math.cos(a) * r * 0.92);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(x, y, r * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const probe = line ? `${line} ${w}` : w;
    if (ctx.measureText(probe).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = probe;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function base(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0F2347');
  g.addColorStop(1, '#15305E');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Faint chakra watermark, bottom right.
  ctx.save();
  ctx.globalAlpha = 0.08;
  drawChakra(ctx, w - 140, h - 160, 260, '#FFFFFF', 5);
  ctx.restore();

  // Header: mark + dual-weight wordmark (Bharat regular, Bol bold).
  drawChakra(ctx, 108, 112, 40, '#FFFFFF', 4);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '500 52px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(BRAND.wordmark.regular, 176, 130);
  const regularW = ctx.measureText(BRAND.wordmark.regular).width;
  ctx.font = '800 52px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(BRAND.wordmark.bold, 176 + regularW + 6, 130);

  // Restrained tricolour rule under the header.
  const y = 176;
  ctx.fillStyle = '#E2892C';
  ctx.fillRect(72, y, 90, 6);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(166, y, 90, 6);
  ctx.fillStyle = '#1E8A5B';
  ctx.fillRect(260, y, 90, 6);
}

function footer(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  url: string,
  hashtags: string
) {
  ctx.fillStyle = '#E2892C';
  ctx.font = '700 40px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(hashtags, 72, h - 208);

  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = '600 40px "Plus Jakarta Sans", sans-serif';
  let shown = url.replace(/^https?:\/\//, '');
  const maxW = w - 144;
  if (ctx.measureText(shown).width > maxW) {
    // Long stand URLs: fall back to the bare domain, ellipsized if needed.
    shown = shown.split('/')[0];
    while (shown.length > 3 && ctx.measureText(`${shown}…`).width > maxW) shown = shown.slice(0, -1);
    if (ctx.measureText(shown).width > maxW) shown = `${shown}…`;
  }
  ctx.fillText(shown, 72, h - 150);

  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '500 34px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`${BRAND.name} - where Bharat speaks.`, 72, h - 96);
  ctx.font = '400 24px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText(HONEST_LINE, 72, h - 48);
}

async function loadFonts() {
  try {
    await Promise.all([
      document.fonts.load('600 84px Fraunces'),
      document.fonts.load('700 148px Fraunces'),
      document.fonts.load('500 44px "IBM Plex Mono"'),
      document.fonts.load('600 40px "Plus Jakarta Sans"'),
      document.fonts.load('800 52px "Plus Jakarta Sans"'),
    ]);
  } catch {
    // Fall back to system fonts; the card still renders.
  }
}

export async function drawProofCard(opts: {
  count: number;
  title: string;
  url: string;
  hashtags?: string;
  format?: CardFormat;
}): Promise<HTMLCanvasElement> {
  await loadFonts();
  const { w, h } = DIMS[opts.format ?? 'portrait'];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  base(ctx, w, h);

  const story = opts.format === 'story';
  // Story format gets extra breathing room at the top.
  let y = story ? 480 : 320;

  // The hook: मैंने बोला। / I spoke.
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 ${story ? 110 : 100}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillText('मैंने बोला।', 72, y);
  y += story ? 90 : 84;
  ctx.fillStyle = '#E2892C';
  ctx.font = '600 60px Fraunces, serif';
  ctx.fillText('I spoke.', 72, y);

  y += story ? 140 : 100;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '500 44px Fraunces, serif';
  ctx.fillText(`I'm 1 of`, 72, y);

  y += story ? 140 : 128;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 ${story ? 148 : 140}px Fraunces, serif`;
  ctx.fillText(fmt(opts.count), 72, y);

  y += story ? 84 : 76;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '500 44px Fraunces, serif';
  ctx.fillText('who said this matters:', 72, y);

  y += story ? 92 : 84;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `600 ${story ? 60 : 56}px Fraunces, serif`;
  const maxTitleLines = story ? 6 : 3;
  for (const line of wrapText(ctx, opts.title, w - 160).slice(0, maxTitleLines)) {
    ctx.fillText(line, 72, y);
    y += story ? 78 : 72;
  }

  // CTA only when it clears the footer block - the footer carries the
  // hashtags and link regardless, so nothing essential is ever lost.
  y += 36;
  if (y <= h - 260) {
    ctx.fillStyle = '#E2892C';
    ctx.font = '600 46px Fraunces, serif';
    ctx.fillText('Bharat, bol. 👉', 72, y);
  }

  footer(ctx, w, h, opts.url, opts.hashtags ?? BRAND.hashtag);
  return canvas;
}

export async function drawCitizenCard(opts: {
  firstName: string;
  stateName: string;
  titles: string[];
  url: string;
  hashtags?: string;
  format?: CardFormat;
}): Promise<HTMLCanvasElement> {
  await loadFonts();
  const { w, h } = DIMS[opts.format ?? 'portrait'];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  base(ctx, w, h);

  let y = opts.format === 'story' ? 520 : 400;

  // "{First name} ne bola." - the badge line.
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 116px Fraunces, serif';
  for (const line of wrapText(ctx, `${opts.firstName} ne bola.`, w - 160).slice(0, 2)) {
    ctx.fillText(line, 72, y);
    y += 126;
  }
  ctx.fillStyle = '#E2892C';
  ctx.font = '500 54px Fraunces, serif';
  ctx.fillText(
    `${opts.firstName} spoke${opts.stateName ? ` · ${opts.stateName}` : ''}`,
    72,
    y
  );
  y += 120;

  ctx.font = '600 44px "Plus Jakarta Sans", sans-serif';
  // Keep the issue list inside the card: show a few titles, then "and N more".
  const maxIssues = opts.format === 'story' ? 4 : 3;
  const shown = opts.titles.slice(0, maxIssues);
  const more = Math.max(0, opts.titles.length - shown.length);
  for (const title of shown) {
    drawChakra(ctx, 92, y - 14, 20, 'rgba(255,255,255,0.8)', 2);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    const lines = wrapText(ctx, title, w - 260).slice(0, 1);
    let line = lines[0] ?? title;
    if (ctx.measureText(line).width > w - 260) {
      while (line.length > 3 && ctx.measureText(`${line}…`).width > w - 260) {
        line = line.slice(0, -1);
      }
      line = `${line}…`;
    }
    ctx.fillText(line, 140, y);
    y += 70;
  }
  if (more > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = '600 40px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`and ${more} more`, 140, y);
  }

  footer(ctx, w, h, opts.url, opts.hashtags ?? BRAND.hashtag);
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
  );
}

/** Native share with PNG when possible; caller falls back to download. */
export async function shareCanvas(canvas: HTMLCanvasElement, text: string, url: string): Promise<boolean> {
  try {
    const blob = await canvasToBlob(canvas);
    const file = new File([blob], 'bharatbol-stand.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text, url });
      return true;
    }
    if (navigator.share) {
      await navigator.share({ text, url });
      return true;
    }
  } catch (e) {
    if ((e as DOMException)?.name === 'AbortError') return true; // user closed the sheet
  }
  return false;
}

/**
 * Download a rendered card as a PNG.
 *
 * Uses a Blob object URL rather than `canvas.toDataURL()`: a 1080×1350 (or
 * ×1920) card easily produces a multi-megabyte data: URI, and Android
 * Chrome silently refuses to download data: URIs past roughly 2 MB — the
 * click does nothing, with no error anywhere. Blob URLs have no such
 * ceiling. The anchor is also appended to the DOM before `.click()`: some
 * Android WebViews ignore the `download` attribute on a detached element.
 */
export async function downloadCanvas(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const blob = await canvasToBlob(canvas);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to pick up the blob before revoking it.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
