# art/: Volt Roadster drop-in visual modules
Standalone ES modules for three r186 (`import ... from 'three'` and `three/examples/jsm/...` only). Each one has a factory with options and a dispose path. All quality params take `'ultra' | 'high' | 'medium' | 'low'`, the same names as `PRESETS` in `post/ultraPost.js` and `src/render/gfx.js`.

| Module | Export(s) | What |
|---|---|---|
| `car/createHypercar.js` | `createHypercar(opts)`, `syncHypercarWheels(car, vc, wheelPos, spinSign)`, `HYPERCAR_DEFAULTS` | Original Roadster-style hypercar with named wheel pivots |
| `robot/createHelperRobot.js` | `createHelperRobot(opts)`, `createRobotIdle(robot, opts)` | VOLT-B humanoid helper, 17 named joints, idle + wave |
| `terrain/moonMaterial.js` | `createMoonMaterial(opts)` | Regolith/crater MeshStandardMaterial (onBeforeCompile) |
| `terrain/marsMaterial.js` | `createMarsMaterial(opts)` | Dust/basalt/strata MeshStandardMaterial (onBeforeCompile) |
| `sky/moonSky.js` | `createMoonSky(opts)` | Black sky, stars, Earth disc + rim glow, harsh sun + fill |
| `sky/marsSky.js` | `createMarsSky(opts)` | Butterscotch sky, blue sunset halo, time of day, dust storm, sun/fill/fog |
| `truck/createPickup.js` | `createPickup(opts)`, `syncPickupWheels(truck, vc, wheelPos, spinSign)`, `PICKUP_DEFAULTS`, `PICKUP_NAME` | **VOLT Ferrox**: original faceted brushed-stainless electric pickup, same API/axes as the hypercar |
| `fx/coldGasThrusters.js` | `createColdGasThrusters(target, opts)` (alias `create`), `THRUSTER_BUDGET` | RCS nozzle clusters + pooled white cold-gas puffs (1 draw call for all puffs) |
| `fx/boostFlame.js` | `createBoostFlame(vehicle, opts)`, `BOOST_VARIANTS` | Additive plasma/flame jets with shock diamonds, 7 colour variants |
| `custom/catalog.js` | `applyCustomization(vehicle, sel)`, `getCatalog()`, `PAINTS`, `FINISHES`, `RIM_COLORS`, `DEFAULT_SELECTION` | One-call customisation for car **and** truck + JSON options list for the UI |
| `custom/wheels.js` | `WHEEL_DESIGNS`, `createWheel`, `createWheelMaterials`, `createCaliper` | 6 wheel designs shared by both vehicles |
| `custom/wraps.js` | `WRAPS`, `installWrap`, `setWrap` | Procedural GLSL wraps (no UVs/textures needed) |
| `custom/parts.js` | `SPOILERS`, `UNDERGLOWS`, `createSpoiler`, `createUnderglow` | Bolt-on spoilers and underglow |
| `custom/gameMap.js` | `fromGameSelection(saveCar)` | Maps the game's existing `src/shop.js` ids onto art ids |
| `post/ultraPost.js` | `createPostPipeline`, `PRESETS`, `detectPreset`, `applyRendererPreset`, `applyShadowPreset` | HDR composer, AA/bloom/GTAO, 120 fps dynamic resolution |

Helpers: `terrain/terrainShaderCommon.js` and `sky/skyCommon.js`, imported by the modules above.
Dev only (don't ship): `preview.html`, `preview.js`, `vite.preview.config.js`, `tools/render-previews.mjs`, `tools/import-check.mjs`.

## Integration snippets (for Game Maker)

### Car (replaces `buildCar` geometry in `src/render/models.js`)
```js
import { createHypercar, syncHypercarWheels } from '../../art/car/createHypercar.js';
const car = createHypercar({ quality: gfx.qName, paint: PAINTS[i].color });
scene.add(car);                       // origin = Rapier chassis body origin (ground at y = -0.72)
// every render frame (after interpolating the body pose onto `car`):
syncHypercarWheels(car, sim.vc, sim.wheelPos);         // suspension + steering + roll
car.userData.setLights({ brake: input.brake > 0, head: true });
car.userData.setBrakeHeat(Math.min(1, brakeHeat));     // glowing discs after hard stops
car.userData.setPaint('#1446c8');                      // paint menu
Object.assign(car.userData.materials.paint, { metalness: 0.75, roughness: 0.28 }); // finishes
car.userData.dispose();
```
- The frame matches `sim.js`: +Z forward, +X = left, wheels 0 FL, 1 FR, 2 RL, 3 RR.
- Pivot names are `wheel_FL`, `wheel_FR`, `wheel_RL`, `wheel_RR`. Roll children are `wheel_XX_spin`. Calipers ride on the pivot, so they steer but don't roll.
- If the wheels roll backwards, pass `spinSign = -1`. If they steer the wrong way, negate `rotation.y`. Rapier's sign conventions depend on the axle axis (-X here).
- Without physics (menus, showroom), use `car.userData.setSteer(a)` and `car.userData.spinWheels(dAngle)`.

### Robots
```js
import { createHelperRobot, createRobotIdle } from '../../art/robot/createHelperRobot.js';
const bot = createHelperRobot({ quality: 'medium', accent: 0xffb020 });   // use 'medium' for 5+ bots
const idle = createRobotIdle(bot, { seed: k });  idle.setWave(true);
// per frame: idle.update(dt);  or drive bot.userData.joints.<name>.rotation directly
```
Joints: `hips, spine, chest, neck, head, shoulderL/R, elbowL/R, wristL/R, hipL/R, kneeL/R, ankleL/R`. Origin is at the feet, facing +Z.

### Terrain (in `levelview.js`, wherever the terrain mesh gets its material)
```js
import { createMoonMaterial } from '../../art/terrain/moonMaterial.js';
import { createMarsMaterial } from '../../art/terrain/marsMaterial.js';
terrainMesh.material = planet === 'moon' ? createMoonMaterial({ quality: gfx.qName })
                     : planet === 'mars' ? createMarsMaterial({ quality: gfx.qName, dustAmount: level.storm ? 0.8 : 0.45 })
                     : terrainMesh.material;
// tweak live: material.userData.uniforms.uDust.value, uCraterDensity, uBump, uScale
```
The geometry needs normals (`computeVertexNormals()`). No UVs are required, because the detail is in world space.

### Skies + lights (replaces the moon/mars branches of `buildEnv` in `env.js`)
```js
import { createMoonSky } from '../../art/sky/moonSky.js';
import { createMarsSky } from '../../art/sky/marsSky.js';
import { applyShadowPreset } from '../../art/post/ultraPost.js';
const sky = planet === 'moon' ? createMoonSky({ quality: gfx.qName })
          : createMarsSky({ quality: gfx.qName, timeOfDay: env === 'marsstorm' ? 0.45 : 0.36, dust: level.storm ?? 0.1 });
scene.add(sky.object, sky.sun, sky.sun.target, sky.fill);
if (sky.fog) scene.fog = sky.fog; else scene.fog = null;      // Moon: no atmosphere
applyShadowPreset(sky.sun, gfx.qName);
scene.environment = sky.bakeEnvironment(gfx.renderer).texture;
// per frame: sky.update(camera, dt); sky.followTarget(carPosition);
// Mars: sky.setTimeOfDay(t), sky.setDust(d). Re-bake the env after big changes (it's cheap, under 5 ms on the phone)
```
The camera far plane must be greater than the dome radius (default 4500). Pass `radius` to match `PRESETS[q].drawDistance`.

### Post / presets (in `src/render/gfx.js`)
```js
import { createPostPipeline, detectPreset } from '../../art/post/ultraPost.js';
const preset = save.settings.quality === 'auto' ? detectPreset(renderer) : save.settings.quality;
const post = createPostPipeline(renderer, scene, camera, { preset, toneMapping: 'agx' });
// loop: post.render(dt)   resize: post.setSize(w, h)   settings: post.setPreset('high')
// scene/camera swap: post.passes.render.scene = s; post.setCamera(cam)
// keep the existing vignette/speed-lines pass: post.composer.insertPass(vigPass, post.composer.passes.indexOf(post.passes.output))
```

### Pickup truck: VOLT Ferrox (`truck/createPickup.js`)
```js
import { createPickup, syncPickupWheels, PICKUP_DEFAULTS } from '../../art/truck/createPickup.js';
const truck = createPickup({ quality: gfx.qName });          // optional: steel, accent, wheelDesign, rim
scene.add(truck);                                            // origin = chassis body, ground at y = -0.86
// physics (same conventions as the car): +Z forward, +X left, wheels 0 FL, 1 FR, 2 RL, 3 RR
//   collider: RAPIER.ColliderDesc.cuboid(1.0, 0.42, 2.6).setTranslation(0, 0.2, 0)
//   wheels:   PICKUP_DEFAULTS.wheelPos ([+-0.9, -0.02, +-1.75]), radius 0.44, width 0.34, rest length 0.40
syncPickupWheels(truck, sim.vc, PICKUP_DEFAULTS.wheelPos);   // per frame
truck.userData.setLights({ head: true, brake });  truck.userData.setBrakeHeat(h);  truck.userData.setPaint('#b5b6b8');
truck.userData.dispose();
```
Same `userData` shape as the car: `kind: 'pickup'`, `wheels[]` (`pivot`, `spin`, `caliper`, `visual`), `materials.paint` (the stainless), `paintMaterials`, `wheelMaterials`, `mounts` (`spoiler`, `boost[]`, `underglow`, `thrusters[]`), `setSteer`, `spinWheels`. About 22k tris on Ultra with parts, 7.6k on Low. Brushed grain is a fine horizontal roughness map on Ultra/High; Medium/Low use plain metal. Material anisotropy is deliberately off: without real tangents it bent reflections on the flat side panels and made them streaky and blue.

### Cold-gas thrusters (`fx/coldGasThrusters.js`)
```js
import { createColdGasThrusters } from '../../art/fx/coldGasThrusters.js';
const rcs = createColdGasThrusters(truck /* or car */, { quality: gfx.qName, scene });  // pass scene: puffs live in world space
// per frame while airborne:
rcs.hover(input.hover);                                // 0..1, down-facing nozzles
rcs.fire(new THREE.Vector3(-1, 0, 0), 1.0);            // THRUST direction in the vehicle frame (this pushes the truck to -X = right)
rcs.update(dt);                                        // always call, also after firing stops, so puffs fade out
rcs.dispose();
```
- `fire(dir, strength, duration = 0.12)`: gas leaves the nozzles that face away from `dir` (dot > 0.35), so `fire(up)` uses the bottom nozzles and `fire(+Z)` uses the rear ones. Call it every frame while the input is held.
- Mount points come from `vehicle.userData.mounts.thrusters` (car 6, truck 10), or pass `opts.mounts` (array of Vector3) for any other Group. `showNozzles: false` hides the nozzle blocks.
- Particle budget per quality: `THRUSTER_BUDGET = { ultra: 1600, high: 1000, medium: 500, low: 160 }`. It is a ring buffer, so it never allocates in the loop. `rcs.activeCount` is for debugging.
- Visual only: apply the impulse yourself in Rapier (`body.applyImpulse(dir.applyQuaternion(rot) * k)`).

### Customisation (`custom/catalog.js`)
```js
import { applyCustomization, getCatalog } from '../../art/custom/catalog.js';
const options = getCatalog();   // JSON: { paints, finishes, wraps, wheels, rimColors, spoilers, underglows, boosts } -> {id, name, preview}
const custom = applyCustomization(car, { paint: 'deep-blue', finish: 'pearl', wrap: 'hex', wheels: 'yspoke',
  rimColor: 'graphite', spoiler: 'wing', underglow: 'magenta', boost: 'inferno' });   // partial updates are fine
// per frame: custom.setBoost(boosting ? 1 : 0); custom.update(dt);    (underglow pulse + flame)
// save: JSON.stringify(custom.toJSON());   teardown: custom.dispose() (vehicle.userData.dispose() also calls it)
```
- Works on both vehicles. `paint` accepts a catalogue id or any hex. `wrapA`/`wrapB` recolour wraps. `caliper` takes a hex. `brushed` is truck-only (`pickupOnly: true`).
- Truck defaults: `raw-steel` + `brushed` + `offroad` wheels + black rims.
- **Existing save ids**: `src/shop.js` uses its own ids (`red`, `spoke5`, `digital`, `classic`...). Use the mapper:
```js
import { fromGameSelection } from '../../art/custom/gameMap.js';
const { selection, unsupported } = fromGameSelection({ paint, finish, wrap, rims, spoiler, underglow, flame });
applyCustomization(car, selection);   // `unsupported` = ids with no art version: wraps checker/flames/lightning/galaxy/circuit/tiger/retrowave
```
  Approximated mappings: candy→gloss, chameleon→pearl, forged/spoke5→Y-Spoke, blade→Turbine, hologram→Neon Ring, swan/dual/active→wing, pulse underglow→cyan, rainbow flame→nebula. Underglow hex chips and `rainbow` pass through unchanged.
- Lower level (optional): `createWheel`/`WHEEL_DESIGNS` (turbine, aero, yspoke, mesh "Lattice", offroad "Beadlock", neon "Neon Ring"); `setWrap(material, id)` on any MeshPhysical/Standard material; `createSpoiler(vehicle, id)`; `createUnderglow(vehicle, '#ff2f92')`; `createBoostFlame(vehicle, { variant: 'plasma' })`.
- Boost variants: plasma, volt, inferno, toxic, nebula, solar, whitehot. Flames point along -Z from `mounts.boost`.

### Bloom / hotspot polish
Bloom thresholds are now 3.6 / 3.6 / 3.8 (radius 0.12/0.12/0.10), so only true emitters (lights 4.5-6, flames, sun) bloom, and lit paint or glass no longer does. Canopy glass is rougher, with less specular. The over-bright roof spot in the old car.png came mostly from the preview's `RoomEnvironment` (its ceiling emitters are about 50x), which a softbox env with bounded HDR now replaces. The game's own env (`env.js`, showroom) was already gentle. **Don't use RoomEnvironment with these materials in-game.** Accent strips were raised from 3 to 6 so they still bloom under the new threshold.

## Preview & checks
```bash
node art/tools/import-check.mjs                     # module smoke test (no GPU)
node art/tools/render-previews.mjs ultra            # -> art/previews/*.png (Chrome + SwiftShader)
node art/tools/render-previews.mjs medium moon,mars
npx vite --config art/vite.preview.config.js --port 5199   # then open /art/preview.html?scene=moon&live=1
```
Scenes: `car`, `car-rear`, `robot`, `moon`, `mars`, `mars-sunset`, `truck`, `truck-34`, `truck-thrusters`, `custom-grid`, `glow-boost`. URL flags: `preset=`, `live=1`, `nobloom=1`, `noao=1`, `nomsaa=1`.
