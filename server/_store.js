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
// B14: saves are stored as PRIVATE blobs (readable only server-side with the store token) under unguessable
// hashed paths. Reads use a direct get() (no list() per load). Legacy public records are read once and migrated.
let privateOk = process.env.BLOB_PUBLIC_ONLY ? false : null; // null = unknown, learned on first write
async function blobGet(path) {
  const B = await blob();
  if (privateOk !== false) { try { const g = await B.get(path, { access: 'private', useCache: false }); if (g && g.statusCode === 200) return await new Response(g.stream).text(); } catch (e) { /* not found / store is public-only */ } }
  try { const h = await B.head(path); if (!h) return null; const r = await fetch(h.url + '?t=' + Date.now(), { cache: 'no-store' }); return r.ok ? await r.text() : null; } catch (e) { return null; }
}
async function blobPut(path, text) {
  const { put, del } = await blob(); const o = { addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 0 };
  if (privateOk !== false) { try { await put(path, text, { ...o, access: 'private' }); privateOk = true; return; } catch (e) { if (privateOk === true) throw e; privateOk = false; } }
  await put(path, text, { ...o, access: 'public' });
}
async function blobDel(path) { const { del } = await blob(); try { await del(path); } catch (e) {} }

export function backend() { return KV_URL && KV_TOKEN ? 'kv' : process.env.BLOB_READ_WRITE_TOKEN ? 'blob' : null; }
// Records are keyed by id + hash(secret) so knowing an id alone never exposes a save; the recovery code maps to the credentials.
const recKey = (id, secret) => `vr:save:${id}:${sha(secret).slice(0, 32)}`;
const codeKey = code => `vr:code:${sha(String(code).toUpperCase())}`;
const blobPath = k => k.replace(/:/g, '/') + '.json';

export async function getRaw(key) { const b = backend(); if (b === 'kv') return await kv(['GET', key]); if (b === 'blob') return await blobGet(blobPath(key)); throw new Error('no-storage'); }
export async function setRaw(key, val) { const b = backend(); if (b === 'kv') return await kv(['SET', key, val]); if (b === 'blob') return await blobPut(blobPath(key), val); throw new Error('no-storage'); }
export async function delRaw(key) { const b = backend(); if (b === 'kv') return await kv(['DEL', key]); if (b === 'blob') return await blobDel(blobPath(key)); }
export { recKey, codeKey };

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  const chunks = []; for await (const c of req) chunks.push(c); const t = Buffer.concat(chunks).toString('utf8'); return t ? JSON.parse(t) : {};
}
export function send(res, status, obj) { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store'); res.end(JSON.stringify(obj)); }
