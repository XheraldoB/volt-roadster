// B14: deletes a device's own cloud record (and its recovery code) once that device restored a different save.
// Requires the record's id + secret, so only the owner can delete it.
import { backend, getRaw, delRaw, recKey, codeKey, readJson, send } from './_store.js';
const ok = (s, n) => typeof s === 'string' && s.length >= 8 && s.length <= n && /^[A-Za-z0-9-]+$/.test(s);
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  if (!backend()) return send(res, 200, { ok: false, error: 'cloud-storage-not-configured' });
  try {
    const { id, secret, code } = (await readJson(req)) || {};
    if (!ok(id, 64) || !ok(secret, 64)) return send(res, 400, { error: 'bad-request' });
    const rk = recKey(id, secret); const had = await getRaw(rk); await delRaw(rk);
    if (typeof code === 'string' && /^VOLT-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) { const ck = codeKey(code); const c = await getRaw(ck); if (c) { const e = typeof c === 'string' ? JSON.parse(c) : c; if (e.id === id && e.secret === secret) await delRaw(ck); } }
    return send(res, 200, { ok: true, deleted: !!had });
  } catch (e) { return send(res, 500, { error: String(e.message || e).slice(0, 200) }); }
}
