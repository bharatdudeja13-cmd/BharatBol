// Canvas rendering for the shareable proof card and the citizen card.
// Cards are 1080×1350 (4:5 — ideal for WhatsApp/Instagram) and drawn
// entirely client-side; nothing is uploaded anywhere.
import { fmt } from './format';

const W = 1080;
const H = 1350;

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

function base(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0F2347');
  g.addColorStop(1, '#15305E');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Faint chakra watermark, bottom right.
  ctx.save();
  ctx.globalAlpha = 0.08;
  drawChakra(ctx, W - 140, H - 160, 260, '#FFFFFF', 5);
  ctx.restore();

  // Header: mark + dual-weight wordmark (Bharat regular, Bol bold).
  drawChakra(ctx, 108, 112, 40, '#FFFFFF', 4);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '500 52px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Bharat', 176, 130);
  const bharatW = ctx.measureText('Bharat').width;
  ctx.font = '800 52px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Bol', 176 + bharatW + 6, 130);

  // Restrained tricolour rule under the header.
  const y = 176;
  ctx.fillStyle = '#E2892C';
  ctx.fillRect(72, y, 90, 6);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(166, y, 90, 6);
  ctx.fillStyle = '#1E8A5B';
  ctx.fillRect(260, y, 90, 6);
}

function footer(ctx: CanvasRenderingContext2D, url: string, tagline: string, disclaimer: string) {
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = '600 40px "Plus Jakarta Sans", sans-serif';
  let shown = url.replace(/^https?:\/\//, '');
  const maxW = W - 144;
  if (ctx.measureText(shown).width > maxW) {
    // Long stand URLs: fall back to the bare domain, ellipsized if needed.
    shown = shown.split('/')[0];
    while (shown.length > 3 && ctx.measureText(`${shown}…`).width > maxW) shown = shown.slice(0, -1);
    if (ctx.measureText(shown).width > maxW) shown = `${shown}…`;
  }
  ctx.fillText(shown, 72, H - 150);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '500 34px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(tagline, 72, H - 96);
  ctx.font = '400 24px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText(disclaimer, 72, H - 48);
}

async function loadFonts() {
  try {
    await Promise.all([
      document.fonts.load('600 84px Fraunces'),
      document.fonts.load('700 130px Fraunces'),
      document.fonts.load('500 44px "IBM Plex Mono"'),
      document.fonts.load('600 40px "Plus Jakarta Sans"'),
    ]);
  } catch {
    // Fall back to system fonts; the card still renders.
  }
}

export async function drawProofCard(opts: {
  count: number;
  title: string;
  url: string;
}): Promise<HTMLCanvasElement> {
  await loadFonts();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  base(ctx);

  let y = 360;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '500 46px Fraunces, serif';
  ctx.fillText('I am one of', 72, y);

  y += 150;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 148px Fraunces, serif';
  ctx.fillText(fmt(opts.count), 72, y);

  y += 88;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '500 46px Fraunces, serif';
  ctx.fillText('citizens standing for', 72, y);

  y += 96;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '600 64px Fraunces, serif';
  for (const line of wrapText(ctx, opts.title, W - 160).slice(0, 5)) {
    ctx.fillText(line, 72, y);
    y += 82;
  }

  y += 40;
  ctx.fillStyle = '#E2892C';
  ctx.font = '600 44px Fraunces, serif';
  ctx.fillText('Where do you stand?', 72, y);

  footer(ctx, opts.url, 'BharatBol — where Bharat speaks.', 'Independent · non-partisan · not an election');
  return canvas;
}

export async function drawCitizenCard(opts: {
  firstName: string;
  stateName: string;
  titles: string[];
  url: string;
}): Promise<HTMLCanvasElement> {
  await loadFonts();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  base(ctx);

  let y = 400;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 120px Fraunces, serif';
  for (const line of wrapText(ctx, opts.firstName, W - 160).slice(0, 2)) {
    ctx.fillText(line, 72, y);
    y += 130;
  }

  ctx.fillStyle = '#E2892C';
  ctx.font = '500 54px Fraunces, serif';
  ctx.fillText(`stands with India${opts.stateName ? ` · ${opts.stateName}` : ''}`, 72, y);
  y += 110;

  ctx.font = '600 44px "Plus Jakarta Sans", sans-serif';
  for (const title of opts.titles.slice(0, 4)) {
    drawChakra(ctx, 92, y - 14, 20, 'rgba(255,255,255,0.8)', 2);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    const lines = wrapText(ctx, title, W - 260).slice(0, 2);
    for (const line of lines) {
      ctx.fillText(line, 140, y);
      y += 58;
    }
    y += 30;
  }

  footer(ctx, opts.url, 'BharatBol — where Bharat speaks.', 'Independent · non-partisan · not an election');
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

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = filename;
  a.click();
}
