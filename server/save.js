import { backend, setRaw, getRaw, recKey, codeKey, readJson, send } from './_store.js';
const ok = (s, n) => typeof s === 'string' && s.length >= 8 && s.length <= n && /^[A-Za-z0-9-]+$/.test(s);
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  if (!backend()) return send(res, 200, { ok: false, error: 'cloud-storage-not-configured' }); // 200 so clients/offline consoles stay clean; ok:false is the signal
  try {
    const b = await readJson(req); const { id, secret, code, data } = b || {};
    if (!ok(id, 64) || !ok(secret, 64) || !/^VOLT-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code || '') || !data || typeof data !== 'object') return send(res, 400, { error: 'bad-request' });
    const body = JSON.stringify(data); if (body.length > 400000) return send(res, 413, { error: 'too-large' });
    // the recovery code may only point at the credentials that first claimed it
    const ck = codeKey(code); const existing = await getRaw(ck);
    if (existing) { const e = typeof existing === 'string' ? JSON.parse(existing) : existing; if (e.id !== id) return send(res, 409, { error: 'code-taken' }); }
    else await setRaw(ck, JSON.stringify({ id, secret, code }));
    await setRaw(recKey(id, secret), JSON.stringify({ updatedAt: data.updatedAt || Date.now(), data }));
    return send(res, 200, { ok: true, backend: backend(), savedAt: Date.now() });
  } catch (e) { return send(res, 500, { error: String(e.message || e).slice(0, 200) }); }
}
