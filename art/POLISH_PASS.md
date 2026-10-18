# Volt Roadster: visual polish pass (18 Oct 2026, ~20:45 Bucharest time, UTC+3)

Reviewed: shots/art-mars-truck.png, live-truck-rcs.png, live-race.png, live-garage.png, t-garage-truck.png and t-m1-truck.png, plus fresh headless shots of the current build. The build went to /tmp/vr-build and the shot tool is `node art/tools/polish-shots.mjs <url> art/previews/polish <suffix> [shots] [quality]`, with /api blocked. Before and after shots are in `art/previews/polish/`.
Scope: art-only edits in src (materials, lighting, post, FX, garage presentation). No gameplay, physics, input, level logic or save-format changes.

## P0: breaks the look on every run
| # | What's wrong | Fix | Files | Status |
|---|---|---|---|---|
| 1 | **Earth day is overexposed and hazy.** Bloom at threshold 2.6 with radius 0.45 picks up the HDR `Sky`, so a white veil sits over the whole frame and distant cars and the truck look ghosted | Use the art bloom presets from `art/post/ultraPost.js`: threshold 3.6, radius 0.12, strength 0.35 to 0.4. Only real emitters bloom now | `src/render/gfx.js` | done |
| 2 | **Roads read as rippling blue water** (Earth) and as **splotchy neon puddles** (Night). The Moon and Mars roads look like bumpy dirt. Causes: blue-tinted asphalt, normal map at 0.4, mirror-ish neon (rough 0.35, metal 0.3) reflecting the city env | Neutral asphalt base, normal scale 0.12 (0.08 on neon), roughness 0.9 (0.55 on neon), env intensity 0.45 (0.7 on neon) | `src/render/textures.js`, `src/render/levelview.js` | done |
| 3 | **Garage turns cars pink or lilac** and the floor shows smeared magenta/cyan/amber bars. The garage reuses the `night` env, whose env map holds saturated city blocks, and a pink 260 cd spot | Neutral softbox studio env for the garage (bounded HDR plus one cyan accent strip). Spot tints softened | `src/render/showroom.js` | done |

## P1: clearly visible
| # | What's wrong | Fix | Files | Status |
|---|---|---|---|---|
| 4 | **Ferrox renders black on the Moon.** The env-map ground is 0x404040, so steel has nothing bright to reflect | Moon env ground set to sunlit regolith (0x9a9a9e on the day Moon, 0x4a4c54 on moonnight) | `src/render/env.js` | done |
| 5 | Boost is only round particle blobs, with no shaped jet | Adopt `art/fx/boostFlame.js` on `userData.nozzles`, driven by the shop flame colours (rainbow animates). Added `setColors()` to the art module. Fewer, smaller spark particles | `src/render/levelview.js`, `art/fx/boostFlame.js` | done |
| 6 | Dust, smoke and boost puffs read as flat discs | Gaussian-like falloff on the shared `glowSprite` | `src/render/textures.js` | done |
| 7 | START arch lettering sits behind the HUD timer at race start (Moon, Mars, Earth) | Lower the arch text or start the chase camera a little lower | `levelview.js` arch / camera framing | **left for Game Maker** (camera framing touches race start) |
| 8 | Mars roadster/truck colours sit close to the dust (low separation) | Slightly cooler rim/fill on Mars, or a darker road edge | `env.js` | P2 candidate, not done |

## P2: nice to have
| # | What's wrong | Fix | Files | Status |
|---|---|---|---|---|
| 9 | The garage floor is now a plain dark disc | Add a subtle softbox reflection strip or a radial gradient texture | `showroom.js` | open |
| 10 | Moon sky stars show faint blocky noise (SwiftShader) | Check on a real GPU first | `env.js` stars texture | open |
| 11 | Night city building windows sparkle and alias at distance | Mipmapped windows texture / lower anisotropy | `textures.js` | open |
| 12 | Garage vehicle-card text overlapped in t-garage-truck.png | Already fixed in the current build (flex-shrink 0 plus block notes) | - | already fixed |

## Earlier issues re-checked
- Earth Day overexposure: **fixed** (#1).
- Road reads as blue water: **fixed** (#2).
- 120 fps dynamic-resolution target on Ultra: **already in place**. `gfx.adapt()` uses `PRESETS[q].target` (120 on Ultra), capped by the measured refresh rate and the FPS cap.
- No AA on Medium/Low: **already in place**. FXAA runs whenever MSAA is 0.
- RoomEnvironment use: **not used anywhere in src/** (only in the dev-only art preview). The garage now has its own studio env (#3).
- Robots in groups of 5+: **already medium**. `buildRobot()` defaults to `'medium'` everywhere, so no change was needed.
- applyCustomization: **not adopted**. The game has its own customisation in `models.js`, which the save and shop drive, and it has more content: 9 finishes, 12 wraps (7 have no art version: checker, flames, lightning, galaxy, circuit, tiger, retrowave), 8 rims and 7 spoilers including active aero. `buildVehicle()` also rewrites `userData.wheels` into pivots. Swapping in applyCustomization through `fromGameSelection` would silently change what players bought (for example, forged rims would turn into Y-Spoke and flame wraps would disappear). That is not a safe art-only change. Better path: port individual art pieces (wheel designs, procedural wraps) into the game's own builders as new shop items.
