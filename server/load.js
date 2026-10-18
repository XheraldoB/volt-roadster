import { backend, getRaw, recKey, codeKey, send } from './_store.js';
export default async function handler(req, res) {
  if (!backend()) return send(res, 200, { ok: false, found: false, data: null, error: 'cloud-storage-not-configured' });
  try {
    const u = new URL(req.url, 'http://x'); const id = u.searchParams.get('id'), secret = u.searchParams.get('secret'), code = u.searchParams.get('code');
    if (code) {
      const c = await getRaw(codeKey(code)); if (!c) return send(res, 404, { error: 'Code not found' });
      const cred = typeof c === 'string' ? JSON.parse(c) : c; const r = await getRaw(recKey(cred.id, cred.secret)); if (!r) return send(res, 404, { error: 'No save for this code yet' });
      const rec = typeof r === 'string' ? JSON.parse(r) : r; return send(res, 200, { id: cred.id, secret: cred.secret, code: cred.code, data: rec.data });
    }
    if (!id || !secret) return send(res, 400, { error: 'bad-request' });
    const r = await getRaw(recKey(id, secret)); if (!r) return send(res, 200, { ok: true, found: false, data: null }); // a new player simply has no save yet
    const rec = typeof r === 'string' ? JSON.parse(r) : r; return send(res, 200, { ok: true, found: true, data: rec.data });
  } catch (e) { return send(res, 500, { error: String(e.message || e).slice(0, 200) }); }
}
