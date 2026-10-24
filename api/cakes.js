// Shared cake box for "Just for Gia Mỹ".
// GET  /api/cakes  -> { cakes: [...] } newest first
// POST /api/cakes  -> stores one cake (validated) and returns { ok: true }
// Storage: Upstash Redis (Vercel Marketplace). Needs either
//   KV_REST_API_URL + KV_REST_API_TOKEN, or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = 'giamy:cakes';
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const MAX_KEEP = 1000;

async function redis(...cmd) {
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error('redis ' + r.status);
  return (await r.json()).result;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const SHAPES = new Set(['round', 'square', 'heart', 'star']);
const DT = new Set(['strawberry', 'cherry', 'blueberry', 'raspberry', 'blackberry', 'candle', 'num20',
  'gem-round', 'gem-drop', 'gem-marq', 'gem-sq', 'gem-tri', 'bowmini', 'sheart', 'sstar', 'sflower', 'pearl', 'sprinkle']);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const chars = (s, n) => [...String(s || '')].slice(0, n).join('');

function clean(o) {
  if (!o || typeof o !== 'object') return null;
  const tiers = (Array.isArray(o.tiers) ? o.tiers : []).slice(0, 3)
    .filter(t => t && SHAPES.has(t.s))
    .map(t => ({ s: t.s, c: HEX.test(t.c) ? t.c : '#f8c8d4', bow: HEX.test(t.bow) ? t.bow : null,
      pt: HEX.test(t.pt) ? t.pt : null, pb: HEX.test(t.pb) ? t.pb : null }));
  if (!tiers.length) return null;
  const d = (Array.isArray(o.d) ? o.d : []).slice(0, 900)
    .filter(x => x && DT.has(x.t) && Number.isFinite(+x.x) && Number.isFinite(+x.y))
    .map(x => ({ t: x.t, x: clamp(+x.x, 0, 400), y: clamp(+x.y, 40, 440), r: clamp(+x.r || 0, -180, 180),
      s: clamp(+x.s || 1, .4, 2), c: x.t.startsWith('gem') ? clamp(x.c | 0, 0, 5) : (HEX.test(x.c) ? x.c : null) }));
  return { tiers, d, msg: chars(o.msg, 50), mc: HEX.test(o.mc) ? o.mc : '#f27aa6', from: chars(o.from, 24), at: Date.now() };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!URL_ || !TOKEN) return res.status(503).json({ error: 'storage_not_connected' });
  try {
    if (req.method === 'GET') {
      const raw = await redis('LRANGE', KEY, '0', '299');
      const cakes = (raw || []).map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
      return res.status(200).json({ cakes });
    }
    if (req.method === 'POST') {
      const ip = String(req.headers['x-forwarded-for'] || 'x').split(',')[0].trim();
      const rk = 'giamy:rl:' + ip;
      const n = await redis('INCR', rk);
      if (n === 1) await redis('EXPIRE', rk, '600');
      if (n > 8) return res.status(429).json({ error: 'too_many' });
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
      const cake = clean(body);
      if (!cake) return res.status(400).json({ error: 'bad_cake' });
      cake.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      const json = JSON.stringify(cake);
      if (json.length > 200000) return res.status(413).json({ error: 'too_big' });
      await redis('LPUSH', KEY, json);
      await redis('LTRIM', KEY, '0', String(MAX_KEEP - 1));
      return res.status(200).json({ ok: true, id: cake.id });
    }
    if (req.method === 'DELETE') {
      const given = String(req.headers['x-admin-key'] || '');
      if (!ADMIN_KEY) return res.status(503).json({ error: 'admin_not_set' });
      if (given !== ADMIN_KEY) return res.status(401).json({ error: 'wrong_key' });
      const id = String((req.query && req.query.id) || '');
      if (!id) return res.status(400).json({ error: 'no_id' });
      const raw = (await redis('LRANGE', KEY, '0', '-1')) || [];
      const hit = raw.find(x => { try { return JSON.parse(x).id === id; } catch { return false; } });
      if (!hit) return res.status(404).json({ error: 'not_found' });
      await redis('LREM', KEY, '1', hit);
      return res.status(200).json({ ok: true });
    }
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'method' });
  } catch (e) {
    return res.status(502).json({ error: 'storage_error' });
  }
}
