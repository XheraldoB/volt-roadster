// Cloud save storage: Upstash Redis REST (Vercel KV / Upstash marketplace) if configured, else Vercel Blob.
import crypto from 'node:crypto';
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function kv(cmd) {
  const r = await fetch(KV_URL, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await r.json(); if (j.error) throw new Error(j.error); return j.result;
}
async function blob() { return await import('@vercel/blob'); }
async function blobGet(path) {
  const { list } = await blob(); const { blobs } = await list({ prefix: path, limit: 1 });
  const b = blobs.find(x => x.pathname === path); if (!b) return null;
  const r = await fetch(b.url + '?t=' + Date.now(), { cache: 'no-store' }); return r.ok ? await r.text() : null;
}
async function blobPut(path, text) { const { put } = await blob(); await put(path, text, { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 0 }); }

export function backend() { return KV_URL && KV_TOKEN ? 'kv' : process.env.BLOB_READ_WRITE_TOKEN ? 'blob' : null; }
// Records are keyed by id + hash(secret) so knowing an id alone never exposes a save; the recovery code maps to the credentials.
const recKey = (id, secret) => `vr:save:${id}:${sha(secret).slice(0, 32)}`;
const codeKey = code => `vr:code:${sha(String(code).toUpperCase())}`;
const blobPath = k => k.replace(/:/g, '/') + '.json';

export async function getRaw(key) { const b = backend(); if (b === 'kv') return await kv(['GET', key]); if (b === 'blob') return await blobGet(blobPath(key)); throw new Error('no-storage'); }
export async function setRaw(key, val) { const b = backend(); if (b === 'kv') return await kv(['SET', key, val]); if (b === 'blob') return await blobPut(blobPath(key), val); throw new Error('no-storage'); }
export { recKey, codeKey };

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  const chunks = []; for await (const c of req) chunks.push(c); const t = Buffer.concat(chunks).toString('utf8'); return t ? JSON.parse(t) : {};
}
export function send(res, status, obj) { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store'); res.end(JSON.stringify(obj)); }
