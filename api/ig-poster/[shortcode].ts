/**
 * Vercel counterpart to worker/index.ts's Instagram poster route.
 * The React app always requests /api/ig-poster/:shortcode, so deployments
 * on either Vercel or Cloudflare can serve the same safe, same-origin image.
 */
type VercelRequest = { method?: string; query: { shortcode?: string | string[] } };
type VercelResponse = {
  status: (status: number) => VercelResponse;
  setHeader: (name: string, value: string) => void;
  end: (body?: string | Uint8Array) => void;
};

const SHORTCODE = /^[A-Za-z0-9_-]{5,64}$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).end('Method not allowed');

  const shortcode = Array.isArray(req.query.shortcode) ? req.query.shortcode[0] : req.query.shortcode;
  if (!shortcode || !SHORTCODE.test(shortcode)) return res.status(404).end('Not found');

  try {
    const upstream = await fetch(`https://www.instagram.com/p/${shortcode}/media/?size=l`, {
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    const contentType = upstream.headers.get('content-type') ?? '';
    if (!upstream.ok || !contentType.startsWith('image/')) return res.status(404).end('Not found');

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).end(new Uint8Array(await upstream.arrayBuffer()));
  } catch {
    return res.status(404).end('Not found');
  }
}
