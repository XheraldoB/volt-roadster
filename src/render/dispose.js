// Frees every GPU resource a scene graph owns: geometries, materials and ALL textures they reference
// (maps, env maps, shader uniforms, scene background/environment). Each resource is disposed once.
// Disposing a texture that is shared/cached elsewhere is safe in three.js: it is re-uploaded on next use.
export function disposeScene(root, extra = []) {
  if (!root) return { geometries: 0, materials: 0, textures: 0 };
  const geos = new Set(), mats = new Set(), texs = new Set();
  const addTex = v => { if (v && v.isTexture) texs.add(v); };
  const addMat = m => {
    if (!m || mats.has(m)) return; mats.add(m);
    for (const k of Object.keys(m)) { const v = m[k]; if (v && v.isTexture) texs.add(v); }
    if (m.uniforms) for (const u of Object.values(m.uniforms)) { const v = u && u.value; if (Array.isArray(v)) v.forEach(addTex); else addTex(v); }
  };
  root.traverse(o => {
    if (o.geometry) geos.add(o.geometry);
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(addMat);
    if (o.isSprite && o.material) addMat(o.material);
    if (o.shadow && o.shadow.map) { o.shadow.map.dispose(); o.shadow.map = null; }
  });
  addTex(root.background); addTex(root.environment);
  geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); texs.forEach(t => t.dispose());
  for (const r of extra) r && r.dispose && r.dispose();
  return { geometries: geos.size, materials: mats.size, textures: texs.size };
}
