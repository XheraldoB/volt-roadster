# Volt Roadster: Art Direction & Visual Upgrade Plan
Owner: Game Art Director. Lead: Game Maker. Date: 2026-10-18. Target device: OnePlus 15 (Snapdragon 8 Elite Gen 5 / Adreno 8-series, 2772x1272, 120/165 Hz).
Pass type: read-only audit of `src/` plus new standalone modules in `art/`. Nothing in `src/` was changed.

---
## 1. Current state (audit, 18 Oct 2026 ~19:45 Bucharest time, UTC+3)

**Stack:** three r186.1, Rapier 0.21 (compat), Vite 5. `npm run build` passes (checked into `/tmp`, so it never touched `dist/`). Bundle sizes: three 577 kB, rapier 4.3 MB (WASM inlined, 1.65 MB gzip, which is the main load-time cost).

**How the look is built today (`src/render/`)**
| Area | Today | File |
|---|---|---|
| Renderer | `WebGLRenderer` with antialias off, sRGB output, **ACES**, exposure set per environment (0.75 to 1.2), `PCFSoftShadowMap` (**removed in r186**, so three logs a warning and falls back to PCF) | gfx.js |
| Presets | low/medium/high/ultra: DPR 1/1.5/2/3, shadows 0/1024/2048/4096, bloom on high and ultra, GTAO on ultra, MSAA 4 on high and ultra, terrain res 96 to 280, draw 900 to 3200 m | gfx.js |
| Post | RenderPass, then GTAO (full res, ultra only), then UnrealBloom (half res, threshold 2.6), then vignette/chroma/speed lines, then OutputPass. **No SMAA/FXAA**, so medium and low have no AA at all | gfx.js |
| Adaptive res | Targets **50 to 58 fps**, which is wrong for a 120/165 Hz goal. Steps of 0.1 every 90 frames | gfx.js |
| Sky | Earth uses the `Sky` addon (Preetham). Moon and Mars use a 3-colour gradient dome plus a star texture. Moon Earth is a textured sphere with a flat 18%-opacity "atmosphere" shell | env.js |
| Lighting | 1 DirectionalLight (follows the player) + 1 HemisphereLight. Env map is a PMREM of a simplified env scene | env.js |
| Terrain | Heightfield from `terrain.js` with craters, canyons and volcano baked into the geometry. Ground textures come from a procedural canvas (`textures.js`) | terrain.js, levelview.js |
| Car | Superellipse loft (28-segment rings), MeshPhysical paint with finishes, wraps and rims. Low-poly, blocky silhouette in the garage | models.js |
| Robots/props | Primitive boxes and cylinders | models.js |
| Particles | CPU pool, one Points draw per pool, additive glow sprite | particles.js |
| UI | HTML/CSS overlay: rounded dark-glass pills, cyan accent, emoji icons | index.html, style.css |

**What looks weak (from `shots/p1-race.png` and `shots/p1-garage.png`)**
1. **Exposure and value structure on Earth Day.** The desert terrain is almost pure white and the sky is pale, so the picture has no midtones or depth. Albedo is too bright and the exposure plus ACES curve crushes it.
2. **Road texture** looks like noisy blue water instead of asphalt (wrong hue, and the grain is far too big for the scale).
3. **Car silhouette** is blocky and low-res. It doesn't read as a premium hypercar, especially in the garage, which is the money shot.
4. **Moon and Mars skies** are flat gradients. There's no blue Martian sunset halo, the Earth has no terminator or atmosphere rim, and the stars are a texture.
5. **Terrain has no surface detail up close.** It has the large forms but no regolith, rocks or strata, so the ground looks like plastic at driving speed.
6. **AA gaps.** Medium and Low have none, and Ultra runs DPR 3 plus full-res GTAO, which is risky for 120 fps.
7. **Lighting is uniform.** There are no contact shadows or AO on Medium and below, and no per-planet light personality (the Moon should have razor-black shadows, Mars warm ambient).
8. **Robots** are primitive boxes. The design brief needs an original, appealing humanoid helper.

**Licensing / IP audit**
- **Assets:** none. There are no image, model, audio or font files. Everything is procedural (canvas textures, emoji glyphs rendered by the OS font, procedural audio). Dependencies: three (MIT), Rapier (Apache-2.0), Vite (MIT), playwright-core (Apache-2.0, dev only), @vercel/blob (Apache-2.0).
- **No Tesla logos or photos** anywhere in `src/` or `art/`.
- **Name risks to fix:**
  - `src/main.js:325` shows the toast text *"Starman says hi"*. "Starman" is closely tied to SpaceX's Roadster mannequin. Rename it, e.g. "the Orbit Driver says hi".
  - REQUIREMENTS uses "Optimus-style". Never put "Optimus" in UI or code strings. Call the robots e.g. "VOLT-B helpers".
  - "Roadster" on its own is a generic word, so "Volt Roadster" is OK. Don't pair it with "Tesla".
- **Real place names** (Valles, Olympus, Tranquility, Copernicus) are fine.
- **Emoji** come from the platform font and render differently per device. Licensing is fine.

---
## 2. Visual target

**Pillars:** *Premium toy-realism*. The car and robots look like a high-end physical scale model (clean surfaces, perfect clearcoat, crisp LEDs). The worlds are physically lit and readable at 150 km/h. Each planet has one unmistakable colour signature, and emissive light is the brand.

**Global palette**
| Role | Colour | Use |
|---|---|---|
| Volt Cyan (brand accent) | `#2EE6FF` | LEDs, UI accent, collectible glow, robot eyes |
| Volt Red (hero paint) | `#B3121F` / `#C4081C` | default car paint |
| Ion Amber | `#FFB020` | coins, warnings, Mars robot variant |
| Graphite | `#1F2227` | trims, joints, UI panels |
| Pearl | `#EEF1F5` | robot shell, UI text |
| Night glass | `#05070A` | canopy, visors, UI glass |

**Mood per planet**
- **Earth.** Golden-hour realism. Warm sun around 5500 K, blue sky (Preetham is fine) with AgX tone mapping. Mid-value terrain: desert albedo 0.35 to 0.45, never above 0.6. Sunset has a strong orange rim light and an ocean glint. Night city is neon magenta/cyan with wet-look roads (low roughness and the env map).
- **Moon** (`art/sky/moonSky.js`, `art/terrain/moonMaterial.js`). Airless and stark. The sky is pure black with crisp procedural stars. The sun is small and harsh (a 5.0 directional light, almost no fill), so shadows are razor-black. Regolith is grey (highland 0.7, maria 0.37 albedo) with bright crater rims. The Earth disc shows a terminator, ocean glint and a thin blue rim. No fog. Exposure is driven by the sunlit ground.
- **Mars** (`art/sky/marsSky.js`, `art/terrain/marsMaterial.js`). The day sky is butterscotch and dusty with a darker brown zenith. Sunsets turn grey-brown with a **blue halo** around a small pale sun. Ground is rust dust on the flats, dark basalt on slopes and layered strata on canyon walls. Ambient is warm and strong (dust scatters a lot of skylight). Storms flatten the sky toward ochre murk and raise exponential fog.

**Car design language: the original "Volt" hypercar** (`art/car/createHypercar.js`)
- Cab-forward teardrop. A low, rounded nose with no grille sits between muscular front fender peaks that rise above the low hood. A single dark glass canopy flows into a fastback. The tail is a Kamm cut with an integrated ducktail lip.
- **Light signature (our trademark, not anyone else's):** slim upper-corner LED blades, a thin full-width "smile" bar across the nose and a single full-width wrap-around tail blade. Cyan centre caps on the wheels.
- Gloss-black arch lips and a carbon splitter, side skirts and 7-fin diffuser. Camera-pod mirrors. 10-spoke turbine rims with an orange caliper accent.
- Proportions match the physics collider (4.3 x 1.9 m, wheelbase 2.74 m, 0.36 m wheels). No badges anywhere: the nose is clean.

**Robot helper style: "VOLT-B"** (`art/robot/createHelperRobot.js`)
- Friendly, slim humanoid at 1.78 m. Rounded pearl-white shell panels with graphite joints and a ribbed abdomen. A black glass face visor with one cyan LED eye bar (it blinks), a chest power ring and a back LED.
- Colour variants are done by accent only: cyan for base crew, amber for Mars or construction, magenta for race marshals.
- Personality comes from the idle animation (breathing, weight shift, look-around) and a wave gesture.

**UI style**
- Keep the current dark-glass pills, but standardise: 16 px radius, 1 px `rgba(46,230,255,.35)` stroke, and a `backdrop-filter: blur(10px)` panel at 60% `#05070A`.
- Numerals use tabular figures with a heavy italic display weight (the speed readout).
- Over time, replace the emoji icons with a single-colour SVG icon set (our own, CC0). That gives consistent rendering across devices.
- Make the battery bar a cyan-to-green gradient that turns amber below 25% and red below 10%, with a pulse.
- HUD safe-area padding is `env(safe-area-inset-*)`. Touch buttons are at least 64 px.

---
## 3. Prioritised upgrades
Perf cost is relative on the OnePlus 15 at Ultra (rough GPU ms at 2772x1272).

| # | Upgrade | Files to touch | Technique | Perf cost |
|---|---|---|---|---|
| 1 | **Fix exposure and tone mapping** | `src/render/gfx.js`, `src/render/env.js`, `src/render/textures.js` | Switch to **AgX** (or keep ACES but lower exposure). Clamp terrain albedo to at most 0.55 and the road to 0.06 to 0.12 grey asphalt. Re-balance sun/hemi per env. Replace `PCFSoftShadowMap` with `PCFShadowMap` + `shadow.radius` | 0 |
| 2 | **New hero car** | `src/render/models.js` (`buildCar`) | Use `art/car/createHypercar.js`: sculpted 220x96 loft, carved wheel wells, clearcoat paint, LED blades, named wheel pivots and `syncHypercarWheels` for Rapier. Keep the PAINTS and FINISHES menus by calling `setPaint` and editing `userData.materials.paint` | ~0.3 ms (80k tris on Ultra, ~45 draws) |
| 3 | **Procedural terrain surface detail** | `src/render/levelview.js` (terrain material) | `createMoonMaterial` / `createMarsMaterial`: world-space multi-scale craters, regolith fbm, slope tint, strata, screen-space bump, LOD fade by pixel footprint | ~0.6 to 1.0 ms Ultra, ~0.3 ms Medium |
| 4 | **Physically-motivated skies** | `src/render/env.js` | `createMoonSky` (procedural stars, Earth with terminator and rim, harsh sun) and `createMarsSky` (time of day, blue halo, storm). Both drive sun, hemi and fog together, and `bakeEnvironment()` gives matching reflections | ~0.1 ms |
| 5 | **Post pipeline and 120 Hz dynamic resolution** | `src/render/gfx.js` | `art/post/ultraPost.js`: HDR half-float, MSAA 4 + SMAA (Ultra), SMAA (High), FXAA (Medium). Bloom with threshold 3.6 (emitters only; revised from 1.8 after the hotspot review). GTAO on Ultra only. **Dyn-res targets 120 fps** with hysteresis. Keep the existing vignette/speed-lines ShaderPass by inserting it before OutputPass | Ultra ~2.5 to 3.5 ms total |
| 6 | Robot helpers | `src/render/models.js` (robot builder), base-building view | `createHelperRobot` + `createRobotIdle`. Use `quality:'medium'` for crowds of 5 or more and merge static ones | 10k to 39k tris each |
| 7 | Road material | `src/render/textures.js`, levelview | Asphalt albedo 0.08 to 0.1 with fine grain (2 to 3 cm/px), clean lane paint, a cyan centre dash as a brand cue, roughness 0.75 (0.25 wet for Night), plus a skid-mark decal pool | ~0 |
| 8 | Particles | `src/render/particles.js` | Soft particles (depth fade). Mars dust: 2-layer billboards + screen-space dust sheet in storms. Moon: ballistic regolith arcs with no drag at 1/6 g. Counts per preset in section 4 | 0.2 to 0.8 ms |
| 9 | Contact shadow under the car | levelview | A blurred blob decal (projected quad) on Low/Medium, where there's no shadow map or AO | ~0 |
| 10 | Speed feel | gfx.js | Speed lines exist. Add FOV kick (+6 deg at boost), subtle radial blur only in boost on Ultra/High, and camera shake on landing | ~0.3 ms |

---
## 4. Graphics presets
These are implemented in `art/post/ultraPost.js` as `PRESETS`, the single source of truth. The game can import it or copy the values into `gfx.js`.

| Setting | **Ultra** (OnePlus 15) | High | Medium | Low |
|---|---|---|---|---|
| Target fps | 120 (uncapped rAF, so 165 when headroom allows) | 90 | 60 | 45 |
| Max pixel ratio | 3 | 2 | 1.5 | 1 |
| Base render scale | 0.9 of the DPR cap | 0.8 | 0.75 | 1.0 |
| Dynamic-res range | 0.70 to 1.00 | 0.65 to 0.90 | 0.60 to 0.85 | 0.60 to 1.00 |
| Scene MSAA | 4x (cheap on tile GPUs) | 0 | 0 | 0 |
| Post AA | SMAA | SMAA | FXAA | none |
| Tone mapping | AgX (ACES option) | AgX | AgX | AgX (no composer) |
| Bloom | 0.40 / r 0.12 / thr 3.6 | 0.35 / 0.12 / 3.6 | 0.30 / 0.10 / 3.8 | off |
| SSAO/GTAO | GTAO, 12 samples, r 0.6, blend 0.9 | off (blob contact shadow) | off | off |
| Shadow map | 4096, PCF r3, extent ±60 m | 2048, PCF r2, ±50 m | 1024, PCF, ±40 m | none (blob) |
| Env map (PMREM) | 512 | 256 | 128 | 64 |
| Texture anisotropy | 8 | 4 | 2 | 1 |
| Particles (dust / sparks / debris) | 6000 / 800 / 300 | 3000 / 400 / 150 | 1200 / 200 / 60 | 400 / 80 / 20 |
| Terrain grid res (`terrainArrays`) | 512 | 384 | 256 | 160 |
| Terrain shader detail | 6 oct, 3 crater layers, triplanar, micro | 5 oct, 3 layers, triplanar | 4 oct, 2 layers | 2 oct, 1 layer |
| Draw distance | 6000 m | 4500 m | 3200 m | 2200 m |
| Car/robot module quality | ultra (80k / 39k tris) | high (51k / 23k) | medium (30k / 10k) | low (14k / 5k) |

**Ultra budget, OnePlus 15 at 120 fps:** 8.3 ms frame. At 2772x1272 x 0.9 the estimate is about 4.5 ms scene + about 3 ms post. GTAO is the first thing dyn-res protects. If you measure more than 8.3 ms with dyn-res at 0.7, turn off GTAO before dropping the preset.
**Recommendations for `gfx.js` today:**
- Its `adapt()` thresholds (50/58 fps) should become `target*0.9` / `target*1.1`, with the target taken from the preset.
- Ultra should not render at full DPR 3 with full-res GTAO.

---
## 5. Verification done in this pass
- `node art/tools/import-check.mjs` imports every module and builds plus disposes each factory at all 4 qualities without a GPU. Result: **ALL OK**.
- `node art/tools/render-previews.mjs ultra` renders through Chrome + SwiftShader with an isolated vite server (port 5199, cache in /tmp). Previews are in `art/previews/`: car, car-rear, robot, moon, mars, mars-sunset (Ultra), plus car-low, moon-medium and mars-medium. They render with zero console errors (the only log is a favicon 404). The Moon and Mars previews use the real `m1` and `r2` level generators, read-only.
- `vite build` into `/tmp/volt-art-buildcheck` compiles. The only warning is the 4.3 MB rapier chunk.
- SwiftShader timings say nothing about device performance. Profile on the phone.


## 6. Pack 2 addendum (pickup, thrusters, customisation)
- **VOLT Ferrox** pickup (`art/truck/`): a three-box faceted wedge in brushed stainless. It has a separate narrower cab with a flat roof, hexagonal wheel arches with black flares, a slatted tonneau and LED light bars. It deliberately avoids the single-apex sail roof and one-piece triangular silhouette of any production truck. Uses no logos or real brand names. Name check: no vehicle trademark was found for "Ferrox" in a quick search (a German casting supplier is called FErrox GmbH). This is not legal clearance.
- Cold-gas RCS: white, short-lived puffs (0.3 to 0.6 s) with strong drag. Normal blending, not additive, so they read as gas rather than fire, which is the visual opposite of the boost flame.
- Customisation follows the palette: emissives come only from lights, accents, underglow and flames. Wraps are two-tone and graphic, with no photographic textures.
