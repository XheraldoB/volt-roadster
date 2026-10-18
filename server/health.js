import { backend, send } from './_store.js';
export default function handler(req, res) { send(res, 200, { ok: true, storage: backend() || 'none', time: Date.now() }); }
