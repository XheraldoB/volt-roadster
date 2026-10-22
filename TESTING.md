# Volt Roadster — QA Test Plan & Bug Log
Owner: Game QA Tester. Lead: Game Maker. Source of truth: REQUIREMENTS.md (every item maps to tests below).
Test device profile: OnePlus 15 landscape, viewport 2772x1272, deviceScaleFactor ~1 (also spot-check DPR 3 at 924x424 CSS), hasTouch, isMobile, Chrome at /usr/bin/google-chrome via playwright-core.
Status: Independent QA pass (Game QA Tester, 2026-10-18 UTC+3) against commit d3f4121 (local `vite build && vite preview` and live https://volt-roadster.vercel.app, which serves the identical d3f4121 bundle hashes). Phase 1 PASS with issues, Phase 2 PARTIAL, Phase 3 PASS with issues. 0 Blocker, 5 Major, 9 Minor, 3 Trivial open (B6-B22). **NOT signed off**: the open Majors must be fixed first. Render-only commits fcc3417..4452ac8 landed during the pass and were not retested; by code inspection none of them touch B6, B7, B9-B16 (B8/B9 may be partially affected by the textures/showroom work). Evidence: qa/*.mjs, qa/*-results.json, qa-shots/. Earlier note kept for history: Phase 1 + 2 automated run PASS 31/31 (tools/qa.mjs, both vehicles, 924x424 DPR2 touch, software GL). Autopilot `npm run simtest` finishes all 23 levels with both vehicles.

## Phase 1 — Technical (local `vite` dev + `vite build && vite preview`)
- T1 Build: `npm run build` succeeds, no warnings that matter; bundle size noted; Rapier WASM loads in prod build.
- T2 Boot: page loads with zero console errors / unhandled rejections / 404s; WebGL2 context created; loading screen to menu < 5 s.
- T3 Viewport: 2772x1272 landscape fills screen, no scrollbars, safe-area insets respected; portrait shows rotate prompt.
- T4 Touch: all controls via touch events only (steer, throttle, brake, jump/boost, menus); multi-touch (steer + throttle at once); no stuck inputs after touch-cancel.
- T5 Performance: Ultra preset, uncapped fps (no 60 cap); log avg/1% low fps and frame time over a 60 s drive per world; memory stable over 10 min (no leak); no physics explosions at high fps.
- T6 Physics (Rapier): fixed timestep independent of frame rate; car doesn't tunnel through ground/walls at max speed; loop traversal holds the car; low gravity on Moon, Mars gravity correct.
- T7 Save: localStorage save/load round trip; cloud save round trip; conflict handling; corrupted save doesn't crash.
- T8 Lifecycle: tab hide/resume pauses game; WebGL context loss recovers; resize/orientation change OK.
- T9 Haptics: navigator.vibrate called on impacts/landings (feature-detected, no errors if missing).

## Phase 2 — Gameplay (req → tests)
- G1 (R1) Points, scoring, levels, progression, win/lose states, HUD correct.
- G2 (R2,R12) Car is original 3D hypercar, Roadster-styled, no logos/photos; graphics quality check via screenshots.
- G3 (R3) Multiple tracks/levels incl. Roadster loop + several more loops; each completable.
- G4 (R4) Battery timer drains, run ends at 0; coins collect; upgrades (tank, speed, others) purchasable and actually change stats; persist.
- G5 (R5) Funny side quests exist, trigger, complete, reward.
- G6 (R6) Minimap tracks car + objectives; world map opens/closes.
- G7 (R7) Races: AI opponents, start, positions, finish, results.
- G8 (R8) Jumping over traffic cars works and is rewarded.
- G9 (R9,R10) Canyon/cliff jumps; precision landing targets detect and score accurately.
- G10 (R11) Extra-ideas list delivered to user.
- G11 (R14,R16) Driving feel: grip, drift, suspension, camera; realism rendering (shadows, PBR, post-fx).
- G12 (R18) Moon: craters, holes, canyons, low gravity.
- G13 (R19) Mars: canyons, volcano, dust storms.
- G14 (R20) Robot helpers (original design) + base building works.
- G15 (R21) Earth, Moon, Mars all unlocked on fresh save.
- G16 (R13) Ultra preset default, settings menu works.
- Edge cases: flip/stuck car reset, out-of-bounds respawn, pause/restart mid-race, rapid menu taps, zero coins purchase, timer hitting 0 mid-air.

## Phase 3 — Release QA (live Vercel URL)
- R1 Live URL loads over HTTPS, correct headers (WASM MIME), no console errors, assets cached.
- R2 Re-run T2–T5, T7 and a smoke pass of G1–G15 against production.
- R3 Cloud save works from production origin.
- R4 Confirm GitHub repo has latest commit matching deploy (req 23).
- Sign-off only with zero open Blocker/Major bugs.

## Independent QA results (2026-10-18, commit d3f4121)
Setup: playwright-core with headless Chrome (/usr/bin/google-chrome, `--headless=new --use-angle=swiftshader --enable-unsafe-swiftshader`). OnePlus 15 landscape emulation: Android Chrome UA, isMobile, hasTouch. Viewports: 2772x1272 at DPR 1 for screenshots and layout, 924x424 at DPR 3 for a spot check, and 924x424 at DPR 1 for the interactive runs, because software GL only reaches about 3 fps at 2772x1272. Input used real CDP `Input.dispatchTouchEvent`, including 3-finger multi-touch, plus `window.__game`. The headless physics runs use the game's own `Sim` in Node (qa/simfps.mjs, qa/feel*.mjs, qa/gap-*.mjs, qa/hovergap.mjs).
Cloud-save rule: the production write path was routed in every live context. All automatic /api/save POSTs and the sendBeacon were blocked. Exactly **one** test record was written (Settings, Sync now; recovery code VOLT-QPM5-VG64-XXS9), then read back from a fresh context. Local preview has no storage backend.

### Phase 1 — Technical
| Test | Result | Evidence |
|---|---|---|
| T1 Build | PASS. Build takes 2.2 s. index 319 KB, three 577 KB, rapier 4.33 MB with the WASM inlined as base64 (1.59 MB brotli on Vercel). No separate .wasm, so there is no WASM MIME dependency. The large first download on mobile data is worth noting. | build log |
| T2 Boot | PASS. Title in 2.4 to 6.5 s locally and 5.1 s live. WebGL2 on, 0 page errors, 0 unhandled rejections, 0 HTTP errors. | p1-results.json |
| T3 Viewport | PASS. No scrollbars at 2772x1272 or 924x424. Safe-area vars in use. Portrait shows the rotate prompt. The HUD has no overlaps at DPR 3. At 2772x1272 DPR 1 the CSS UI renders at 1/3 size, which is an emulation artefact (the real phone is about 924 CSS px wide). | p1-dpr3-race.png |
| T4 Touch | PASS. Taps work for title, map, level card and race. Steer + boost + jump held together are all registered (steerCur 0.39, boosting). Sliding from ▶ to ◀ without lifting switches steering. touchCancel clears every input. | p1-results.json `multitouch` |
| T5 Perf | INDICATIVE ONLY (software GL is not the phone). 924x424 Low: about 10 to 13 fps. Sim CPU is 0.7 to 1.3 ms per frame (about 0.1 ms per 120 Hz step). Render submit CPU is 4.8 to 6.5 ms per frame. JS heap stays at 22 to 54 MB with no growth trend. GPU textures leak, see B8. Ultra is auto-selected for "Adreno (TM) 840" (spoofed) and fpsCap defaults to 0 (uncapped). | p1/p2 results |
| T6 Physics | PASS. All 23 levels finish with both vehicles at 24, 60 and 165 fps render rates (fixed 120 Hz step). No explosions (max 225 km/h). No real tunneling: every "below road" frame traced back to undershooting a gap and hitting the cliff face. Free-fall g: Earth 9.76 (9.81), Moon 1.75 (1.62), Mars 3.80 (3.71). Loops hold the car (2 to 6 loops per level). | qa/simfps-*.log |
| T7 Save | PASS. Local save survives a reload (upgrades, coins, customization). Cloud save plus recovery-code restore works on production, see Phase 3. | p2/p3 results |
| T8 Lifecycle | PARTIAL. visibilitychange to hidden pauses the race. Resize and rotation re-layout correctly. A forced WebGL context loss/restore recovers (with warnings, B18). Rotating to portrait mid-race does **not** pause, see B10. | p1-portrait-midrace.png |
| T9 Haptics | PASS (API level). 197 `navigator.vibrate` calls in a session (taps, coins, landings, crashes). Actual vibration feel is untestable here. | p1 `vibrate_calls` |

### Phase 2 — Gameplay
Driving feel (Node metrics on the same Sim):
- Roadster: 0–100 km/h in 2.98 s.
- Ferrox: 0–100 km/h in 4.16 s.
- Braking from 100 to 0 km/h: 64.6 m / 4.7 s for both vehicles. Too long, see B11.
- Full steer at 80 km/h: 42° of heading change in 0.6 s, which is very twitchy (B12). Slip stays small (−4°), so the car grips rather than drifts.
- Drift: 120 km/h at full steer triggers drift scoring (30–35° slip on the roadster). The Ferrox spins (73–78° slip).
- Suspension: settles a 1 m drop in about 4 oscillations, no bottoming.
- Camera: the chase, close, hood and drone modes all cycle.

Edge cases:
- An upside-down car auto-respawns.
- Out-of-bounds (150 m off track) produces an "off" crash and a respawn.
- Pause/Restart mid-race resets time, coins and position.
- Pausing during the countdown freezes it.
- 8 rapid taps on an upgrade with funds for 1 buy exactly 1, and coins never go negative.
- Unaffordable upgrades are disabled, coin and gem items are refused with a toast, and gem packs show "coming soon" (checkout returns 501).
- Battery hitting 0 mid-air leads to landing, then the "OUT OF BATTERY" results screen. No softlock.
- Double-tapping Retry loads once.

Cold-gas hover: broken as designed, see B6.

Shop and customizer:
- Speed ×2 raises the top speed shown and the sim vmax from 187 to 230 km/h.
- The tank upgrade raises the sim tank from 60 to 72 s.
- Paint, rims and spoiler buys equip, show on the car and persist after a reload.

Base:
- A Robot Bay adds 1 robot (sim.robots = 1, checkpoint bonus +1 s).
- A Trophy Hall opens the Trophy Room.

Autopilot with a stock car (qa/simfps.mjs) observed:
- 18 car jumps
- pad and perfect landings
- side quests completed on 11/23 levels
- meteor hits on the Moon and dust-devil rides on Mars

### Requirements map (REQUIREMENTS.md)
| Req | Result | Notes |
|---|---|---|
| 1 Full game | PASS | Scoring, combos, stars, results, unlock chain, achievements (26), dailies |
| 2 Original Roadster-styled car | PARTIAL | Original design with no logos. Visible floating parts (B9) |
| 3 Tracks + loops | PASS | 23 levels, every level has at least 1 loop (e6 has 6) |
| 4 Battery timer, coins, upgrades | PASS | Upgrades change sim stats and persist |
| 5 Funny side quests | PASS | Mailbox, pizza, cow, ring, alien, rover; completed in runs |
| 6 Minimap + world map | PASS | Heading-up minimap, tap for full-track map, planet/level map |
| 7 Races | PASS | 3 AI, live position, position bonus |
| 8 Jump over cars | PASS | 18 car jumps in autopilot runs, kickers present |
| 9 Canyons/cliffs | PASS | 52 gaps; a stock car at full throttle clears 47 |
| 10 Precision landing | PASS | Pad and PERFECT scoring observed; precision levels e2, e7, m4, r6 |
| 11 Ideas list to user | N/A | Not part of the build |
| 12 Great graphics | PARTIAL | Ultra looks good (AgX, bloom, GTAO), but car model defects (B9) and low-contrast HUD text (B17) |
| 13 OnePlus 15 tuned | PARTIAL | Ultra auto-tier, uncapped fps, haptics wired. Real-device fps untestable. B10 |
| 14 Realism techniques | PASS | PBR/AgX/GTAO/PCF shadows; Rapier raycast vehicle. Feel issues B11/B12 |
| 15 Quality | PARTIAL | Open Majors |
| 16 Rapier | PASS | rapier3d-compat 0.21, fixed 120 Hz step |
| 17 3-phase test | IN PROGRESS | This pass. Fixes pending |
| 18 Moon | PASS | Craters/pits visible, 1/6 g, meteor showers |
| 19 Mars | PASS | Canyons, Olympus levels, storms cut grip (r2–r7), dust devils (B16) |
| 20 Robots + base | PASS | Robots walk the base, 6 building types, Robot Bay feeds sim |
| 21 All planets unlocked | PASS | Level 1 of Earth/Moon/Mars open on a fresh save |
| 22 Local + cloud save | PASS | Local persist; prod cloud save + code restore round trip |
| 23 GitHub + Vercel | PARTIAL | Live = d3f4121 (identical asset hashes). The /workspace repo has no git remote, so the GitHub state was not verified. Commits after d3f4121 are not deployed |
| 24 Other bots | N/A | |
| 25 Extras | PARTIAL | Verified: photo mode (6 filters, capture/download), ghost replay, rocket cutscene, customizer, Spaceport level, meteors, dust devils, dailies, trophy room, drone cam. Not verifiable here: radio audio, bullet-time feel, Easter egg sighting |
| 26 Customization + premium | PASS | Coin and gem items. Gem store disabled and honest (no fake purchase) |
| 27 Cybertruck-style + cold gas | PARTIAL | Vehicle looks right. Hover over-thrusts (B6), free selection (B7) |

### Phase 3 — Release (live)
| Test | Result |
|---|---|
| R1 | PASS. HTTPS with HSTS preload. HTML `max-age=0, must-revalidate`. /assets/* `immutable` 1 y. Brotli on. sw.js `no-cache`. Manifest `application/manifest+json`. Live index.html and asset hashes are byte-identical to the local d3f4121 build. Console clean (0 errors). /api/health reports storage=blob. |
| R2 | PASS. Smoke on live: touch nav to an e1 race, 20 s autopilot drive; Ferrox on Moon (g 1.62), roadster on Mars (g 3.71). No errors. |
| R3 | PASS. One cloud record written (Sync now, ok:true, backend blob). A fresh device restored it with the lowercase code: coins 4242, gold paint, upgrades, e1 record and stats all intact after a reload. A wrong code shows "Restore failed: Code not found". A leading space in a pasted code truncates it (B13). |
| Orientation/fullscreen | PASS. Portrait shows the "Rotate your phone" overlay. ⛶ enters fullscreen and locks landscape-primary; a second tap exits. The service worker registers. The fullscreen button exists only on the title screen. |
| R4 | NOT VERIFIED (no git remote in /workspace/volt-roadster). |

## Real-player checklist (added Oct 18 after the owner's OnePlus 15 playtest; mandatory every regression pass)
Driven only by touch, the way a real player would, on every vehicle, on Earth plus at least one Moon and one Mars level. Each item has a pass rule.
- RP1 Reverse: from a standstill, holding brake/reverse backs up within 1 s, reaches a usable reverse speed (at least 15 km/h), and you can steer while reversing. You can back out of a head-on wall hit without help.
- RP2 Brake to stop: from 100 km/h, braking stops the car in 45 m or less, stays straight, and the car stays stopped (no creeping) while held.
- RP3 Flip recovery: after a roll onto the roof or side, the car rights itself automatically or with one obvious button within 3 s, without losing the run.
- RP4 Getting unstuck: wedged in a ditch, against a rock, on a crater rim or across a barrier, you can get free with throttle/reverse/steer, or a reset button puts you back on the track within 3 s.
- RP5 Respawn: falling off the map or into a canyon respawns you facing the right way on the track within 3 s, with no double penalty and no respawn loop.
- RP6 Low-speed steering: at 5 to 30 km/h the car turns tightly enough for a 3-point turn and parking-style moves, with no dead zone or lag you can feel. Steering is not twitchy at mid speed (B12).
- RP7 Air control with thrusters: in the air the player can pitch, roll and yaw to level the car and steer toward a landing pad with thruster input. Inputs respond within 1 frame, and a precision landing is doable by hand in at most 3 tries.
- RP8 Touch controls: controls are large enough for a thumb (at least about 9 mm), work with multi-touch, never stick after a finger slides off, and steering + throttle + jump work at the same time. Test the touch zones on the 2772x1272 layout by looking at screenshots.
- RP9 Image sharpness: rendering runs at the native device resolution on Ultra (check renderer.getPixelRatio and drawing-buffer size against the screen). HUD and car edges are crisp in screenshots, with no blur, washed-out tonemapping or overpowering sun bloom/glare. Compare the screenshots with the light coming toward the camera and away from it.
- RP10 Frame-time stability: over 60 s of driving, record per-frame times. No GC or shader-compile hitches over 50 ms after the first 5 s, the 99th percentile is under 2x the median, and nothing is capped at 60. Software GL can only show relative stutter, so flag that a final check on the real phone is required.
- RP11 Hand-feel sanity: one full race and one canyon jump per world played start to finish by touch, noting anything that feels off even if it passes the numbers.

## Bug log
Format: ID | Severity (Blocker/Major/Minor/Trivial) | Phase | Title | Steps | Expected | Actual | Status
B1 | Major | P1 | Physics explosion (2,600 m/s) | autopilot e-levels | stable | kinematic traffic teleported via setNextKinematicTranslation | FIXED (setTranslation + wrap guard + velocity clamp)
B2 | Major | P2 | Overexposed white frame | any level, high | readable image | bloom threshold/env too bright | FIXED (AgX, threshold, env 0.28)
B3 | Minor | P1 | /api 404 under vite preview -> console error | preview | 0 errors | no local API | FIXED (vite local-api middleware, 200 for not-found)
B4 | Major | P2 | Pickup fails big gaps (e4, r3) | VEH=hauler simtest | completes | heavy truck under jump speed | FIXED (ramp launch assist + RCS hover)
B5 | Minor | P2 | Garage notes overlapped | garage vehicle tab | readable | .hint class collided with absolute-positioned hint | FIXED
B6 | Major | P2 | Ferrox cold-gas "hover" climbs instead of hovering, so holding JUMP overshoots landings by about 150 m | 1) `__game.setVehicle('hauler')`, `__game.loadLevel('e1','trial')`. 2) Full throttle into Baby Canyon (gap s0≈1019, pad s≈1116 r9). 3) Hold ⬆ (JUMP) from just after takeoff. Headless repro: `MODE=hold node qa/hovergap.mjs e1` and `node qa/feel2.mjs` | Holding JUMP holds altitude or gives a slow controlled descent ("hold JUMP to hover / soft-land" per the garage note and README) | sim.js L422-426 applies `g*1.12 + 2.2*max(0,-vy)` upward, which is a net +0.12 g climb whenever vy≥0. Vertical speed rises from +7.5 to +9.9 m/s, the truck peaks 41 m above the road and lands at s≈1268, 152 m past the pad. Touchdown is −24.6 m/s (plain jump: lands s≈1129). Holding from rest 20 m up climbs 2.2 m, empties the 2.5 s tank and touches down at −18.1 m/s, worse than no input (−17.3). Only a timed late burn soft-lands (−3.5 m/s). Same on Moon and Mars | PARTIAL: no climb anymore (vy holds ≈ −1.2 m/s, sinks slowly); hold-through on e1 still glides past the pad (fuel empties at s≈1196, 13 m freefall, touchdown −14.8 m/s at s≈1239). drive.test hover checks pass. Still open (qa/hovergap.mjs, qa/feel2.mjs, f64290d)
B7 | Major | P2 | Ferrox pickup (price 🪙6000) can be selected for free | Fresh save (300 coins), Garage, Vehicle, tap SELECT on Volt Ferrox | Locked behind 🪙6000 (vehicles.js `price:{coins:6000}`) with a buy/confirm step, or remove the price if free is intended | Vehicle switches to hauler and coins stay 300. The main.js `[data-veh]` handler has no price or ownership check (p2-results.json `hauler_price_check`) | FIXED f64290d (Garage shows BUY 🪙6,000; drive.test B7 x3 PASS; r4-garage-ultra.png)
B8 | Major | P1 | GPU texture leak on every level load (VRAM growth on phone) | Loop `await __game.loadLevel(id)` over e3, m3, r3, e6 eight times and read `__game.gfx.renderer.info.memory.textures` | Texture count returns to baseline after a level is disposed | 86→97→112→127→142→153→168→183 (about +14 per load). Geometry count is stable. LevelView.dispose() disposes geometries and materials but never their textures (non-cached CanvasTextures from textures.js, e.g. L75 sign/billboard textures, plus env/terrain maps). Retry and Next on a phone keep stacking VRAM until a context loss | FIXED f64290d (8 loads: textures 38,31,35,39,39,32,36,40; qa/p4-results.json)
B9 | Major | P2 | Hero car has detached floating parts (roof plate, mirror cubes, headlight strips) | Title screen or Garage, any quality (Ultra shown). See qa-shots/vis-garage-ultra.png, p1-title-2772.png | Parts sit flush on the body | A body-colour roof plate hovers above the glass canopy (models.js L93, box at y=0.435). Two small red cubes (mirrors/intakes) float beside the cabin, white headlight slits float above the hood, and there are dark artefacts on the front wheel arch. Very visible in the 3D hero shots (R2/R12) | STILL OPEN f64290d (roof plate, red mirror cube, headlight bits still detached: r4-garage-ultra.png, r4-title-2772.png)
B10 | Major | P1 | Rotating to portrait mid-race doesn't pause; the race keeps running under the rotate overlay | Start any race (e2), wait for GO, rotate the phone (viewport to portrait) for 3 s, rotate back | Game pauses while the rotate prompt is up (like visibility hidden) | `#rotate` covers the screen but the sim keeps running: raceTime 2.0→3.9 s and battery 58→56 s in 3 s, with auto-gas still driving blind (p1-results.json `orientation`, p1-portrait-midrace.png) | FIXED f64290d (portrait 3 s: raceTime 0.52→0.52, battery unchanged, blocked=portrait; r4-portrait.png)
B11 | Minor | P2 | Brakes are weak: 100→0 km/h takes 64.6 m / 4.7 s (≈0.6 g) on both vehicles | `node qa/feel2.mjs` (e1 straight, respawnAt(25, 27.8), brake=1) | Hypercar stops in roughly 30–35 m; the heavy pickup should differ from the roadster | 64.6 m for both. Braking force is scaled by mass/1650, so the pickup brakes identically to the roadster | FIXED f64290d (roadster 32.4 m, hauler 40.4 m from 100 km/h)
B12 | Minor | P2 | Steering is very twitchy at mid speed with digital touch buttons | e1, 80 km/h, hold ▶ (or 0.5 analog) for 0.6 s (`node qa/feel2.mjs`) | Progressive turn-in that a thumb can modulate | 42° of heading in 0.6 s at full input and 36° at half input. The car reaches the wall in under 0.7 s, and a 42° wall hit drops 79→3 km/h with no crash or respawn. Hard to drive precisely with on/off buttons | FIXED f64290d (80 km/h 0.6 s: full 23°, half 8.5°; roadster)
B13 | Minor | P3 | Restore code with a leading space/newline is truncated, giving "Code not found" | Settings, Cloud save, paste " VOLT-XXXX-XXXX-XXXX" (leading space), Restore | Input trims whitespace before the 19-char limit | `maxlength=19` truncates first, leaving " VOLT-XXXX-XXXX-XXX", so the server returns 404 (seen live: `/api/load?code=VOLT-8XYC-5LBZ-5UT`) | STILL OPEN f64290d (live: " VOLT-QPM5-VG64-XXS9" → value " VOLT-QPM5-VG64-XXS" → 404; maxlength=19 unchanged)
B14 | Minor | P3 | Every fresh launch writes a cloud record before the player does anything; restoring leaves an orphan record | Open the live site in a new profile: boot runs cloudLoad, then cloudSync POST /api/save | Write on the first meaningful progress, or reuse identity on restore | Each new device or visitor creates 2 blobs (code + save). Restoring on a device orphans that device's own record. Each /api/load does a Blob `list()`. Saves are `access:'public'` blobs, unguessable but world-readable by URL. Cost/quota and privacy hygiene | STILL OPEN f64290d (fresh live boot still POSTs /api/save; Blob list() in server/_store.js)
B15 | Minor | P2 | Landing impact isn't penalised: the pickup lands at −24.6 m/s vertical and scores "CLEAN LANDING" | Same as B6 (hover overshoot), or drop from 30 m | Very hard landings damage, bounce or crash the car (R16 realism) | Crash-on-landing only checks orientation (sim.js landed()), so any upright touchdown is clean | FIXED f64290d (40 m drop = crash/HARD LANDING, drive.test)
B16 | Minor | P2 | Mars dust devil launches the car off the road on curves | `node qa/devil-trace.mjs r1 274` (devil at s=300): 11 m/s vertical impulse plus 5.8 s airtime in Mars gravity | Boost keeps the car on or near the track | The car flies straight while the track curves, lands at x≈26 m (road half-width 7) on terrain, then drives under the Rust Rift ramp and falls (fall crash). Steering in the air only yaws the car, so the player can't correct | FIXED f64290d (dust devil hop 0.66 s air, drive.test)
B17 | Minor | P2 | HUD text too small and low-contrast on bright skies | Any day level (e1), screenshot p1-race-hud.png / p1-dpr3-race.png | Level name, km/h unit and BOOST/THRUST labels readable at arm's length | Level/mode title and the small labels are about 7–8 CSS px, light grey over the bright sky, and practically unreadable | PARTIAL f64290d (at real-phone CSS 924x424 DPR3 km/h, BOOST/THRUST readable; level-name line still tiny/low contrast: r4-dpr3-ultra.png)
B18 | Minor | P1 | No pause when the WebGL context is lost; console warnings after restore | In race: `ext=gl.getExtension('WEBGL_lose_context'); ext.loseContext(); setTimeout(()=>ext.restoreContext(),1000)` | Clean recovery with no GL errors, ideally paused while lost | Rendering recovers and the race continues, but there are 11× "WebGL: INVALID_OPERATION: delete/deleteVertexArray: object does not belong to this context" (stale objects disposed after restore). The sim also keeps running while the screen is black | FIXED f64290d (context loss pauses: blocked=context; 0 WebGL warnings after restore)
B19 | Minor | P2 | Achievement toast covers the results title | Finish e1 for the first time | Toast placed clear of the results headline | The "🏆 First Finish" toast sits on top of "1ST PLACE!" (p2-results.png) | NOT RETESTED this round
B20 | Trivial | P1 | FPS counter can never show below 10 | Settings, Show FPS, on a slow GPU | Real fps | dt is clamped to 0.1 s before the fps average, so the counter shows 10 while actual is about 3.5 fps (2772x1272 software GL). The sim also runs at about 0.8× real time below 12 fps (max 10 substeps), intentional but worth knowing | FIXED f64290d (counter showed 0.27 fps at 2772 Ultra software GL)
B21 | Trivial | P2 | Base hex pad renders split in two | Base, Earth, top-right pad (vis-base-ultra.png) | Whole hex pad | Pad appears cut into two pieces where the terrain pokes through the middle | STILL OPEN f64290d (r4-base-ultra.png, top-right pad still split)
B22 | Trivial | P1 | Moon free-fall acceleration measured 1.75 m/s² vs configured 1.62 | Pause, lift the car 60 m, step the sim 0.5 s with no input (p1 `gravity`) | 1.62 | 1.75 (+8%); Mars 3.80 vs 3.71, Earth 9.76 vs 9.81. Small extra downward force while airborne on low-g worlds | FIXED f64290d (free-fall 9.81 / 1.62 / 3.71 exact, drive.test)

## Fix-round results (dev, 2026-10-22)
| Item | Status | Evidence |
|---|---|---|
| B6 reverse / brakes | FIXED | tests/drive.test.mjs (reverse, brake distance, no creep) + tests/player.browser.mjs touch BRAKE→REV |
| B7 vehicle ownership | FIXED | drive.test ownership checks; two-tap purchase; setVehicle requires ownership |
| B8 / B10 / B18 hidden-tab, context loss, portrait pause | FIXED | blocked/pause handling in main.js; pause test in player.browser.mjs |
| B11–B12 steering / touch | FIXED | analog pad, sensitivity, ESC; drive.test steering + multitouch browser test |
| B15 hard landings / crashes by impact speed | FIXED | drive.test hard landing not CLEAN |
| B16 dust devil short hop | FIXED | drive.test dust devil |
| B20 real fps | FIXED | rawDt fps; __game.frameTimes() |
| B22 gravity | FIXED | drive.test exact free-fall |
| B9, B13, B14, B17, B19, B21 | FIXED in round 3 | see below |
| RP3 reverse, RP4 brake, RP5 recovery/respawn, RP6 air control, RP7 pause/restart | PASS (automated) | drive.test 57/59, player.browser 12/12 |
| RP9 sharpness | PASS (screenshot) | qa-shots/rp9-sharpness.png (DPR capped at 2, FXAA, quarter-res bloom) |
| RP10 frame telemetry | PASS | __game.pixelRatio / drawingBuffer / frameTimes(n); 120 fps on device still needs a real-phone check |
| Pad steering | PASS | all 12 pad-steer cases incl. hauler r1 ±3 m (round 3) |

## Fix round 3 (dev, 2026-10-22)
| Item | Status | Evidence |
|---|---|---|
| B9 floating hero-car parts | FIXED | roof plate removed, flush black mirror pods, headlights/DRLs follow the nose slope (title/garage shots) |
| B13 restore code with spaces | FIXED | input normalised (spaces, dashes, lower case, missing VOLT- prefix) before lookup; maxlength no longer truncates |
| B14 cloud hygiene | FIXED | no identity or request on a fresh launch (player.browser B14 check: 0 /api calls); first write only after real progress; saves written as private blobs read server-side via get() (falls back to public only if the store is public-only); restoring deletes this device's previous record via POST /api/forget (id+secret required) |
| B17 HUD legibility | FIXED | level title, km/h, BOOST/THRUST and quest line >= 11 CSS px, full white, bold, dark halo |
| B19 toast over results title | FIXED | on the results screen toasts dock at the bottom |
| B21 split base pad | FIXED | base ground uses radial rings so the 40 m centre is flat (the fan disc interpolated rim height through the pads) |
| HUD horizon indicator | DONE | airborne-only attitude ball (roll + pitch) with landing verdict colour (green pad / red too hard) |
| Quest types fragile / speedtrap / statGoal | DONE | 6 bonus side quests (e2, e4, e5, e6, m1, r4) unlock after a level's main quest; tests/quests.test.mjs 15/15; autopilot completes the e4/e5/e6/m1 bonuses |
| InstancedMesh / batching pass | DONE | static props and vehicles merged per material, pickups instanced, per-frame allocations removed; e1 draw calls 799 -> 480 |
| QA p4 RP8: tiny HUD icon buttons | FIXED | touch HUD buttons >= max(46 px, 10vh) |
| Suites | PASS | drive 59/59, quests 15/15, simtest 23/23 roadster + 23/23 hauler, qa.mjs 31/31, player.browser 13/13 |

## Regression round (independent QA, 2026-10-22, commit f64290d)
Build: f64290d built in a separate worktree (/workspace/volt-roadster-qa-f64290d, outDir /workspace/vr-dist-f64290d) and served with vite preview :4173. The live site serves the same asset hashes (index-C6XdSbKq.js, index-D89GX7p2.css, three-zySor9gr.js, rapier-BYHDSJ8_.js), so live = f64290d. Live console is clean apart from the B13 404. **Zero live cloud writes this round** (the boot POST was blocked). Restore read with VOLT-QPM5-VG64-XXS9 (typed lowercase) gives coins 4242 and gold paint. Scripts: qa/p4.mjs, qa/p4b.mjs, qa/p4c.mjs, qa/p4-live.mjs. Results: qa/p4*-results.json.

Real-player checklist (touch = CDP multi-touch at 2772x1272 unless noted; sim numbers from tests/drive.test.mjs 57/59 and qa/feel2.mjs):
| RP | Result | Measured |
|---|---|---|
| RP1 Reverse | PASS | Touch BRAKE/REV from standstill: reverse in 0.42 s game time, 18.6 km/h (sim cap: roadster 30, hauler 27). Steering pad while reversing: 60° yaw in 1.2 s. Nothing stuck after release |
| RP2 Brake | PASS | 100→0: roadster 32.4–32.9 m, hauler 40.4–40.8 m, lateral drift 0.00 m, creep 0.5 m after release |
| RP3 Flip | PASS | Auto-right in 1.27 s, reset button instant (sim) |
| RP4 Unstuck | PASS | Wedged auto-reset in 2.73 s (sim) |
| RP5 Respawn | PASS | Canyon fall → respawn in 1.61 s facing forward (dot 0.95), 1 crash counted |
| RP6 Low-speed steer | PASS | 15 km/h full lock: roadster 41°, hauler 29° in 1.2 s. 80 km/h: 23° full and 8.5° half in 0.6 s (B12 fixed) |
| RP7 Air control | PARTIAL | Input responds in 1 frame, auto-levels in under 2 s. Pad steering: 10/12 cases land on the pad. **Ferrox on Mars r1 misses the pad both ways (B23).** Manual "≤3 tries" needs a real phone |
| RP8 Touch | PASS (minor) | At real-phone CSS (924x424 DPR3): steer pad 28.7 mm, BRAKE 14.3, JUMP 13.6, BOOST 11.5, DRIFT 9.3 mm. GAS is hidden by autoGas (17.2 mm when shown). Pad + gas + jump + boost all register together. Gas→brake slide works. touchCancel and release clear everything. The pause and top HUD buttons are only about 4 mm (B25) |
| RP9 Sharpness | FAIL | Ultra caps pixelRatio at 2. On the phone (DPR 3) the drawing buffer is 1848x848 vs native 2772x1272 (44% of the pixels), and dynScale can lower it further (B24). Tonemapping now looks good: toward and away from the sun (e1 55°/155°, r1 48°/132° off-sun) have similar exposure, no washed-out haze or bloom glare in race (r4-sun-*-e1/r1.png). The sun is high (elev 42°), so it is never in frame; true sun-in-frame glare is untested. The title screen still has a soft white haze on the left (r4-title-2772.png) |
| RP10 Frame time | INCONCLUSIVE (software GL) | 60 s auto-drive at 924x424. Performance preset: median 150 ms, p99 483 (3.2×), max 4.2 s. Low: median 117 ms, p99 433 (3.7×), max 3.55 s. fpsCap 0 (uncapped), no 16.7 ms clamp. Stalls of several seconds appear on level load/start. Must be measured on the phone with __game.frameTimes() |
| RP11 Hand feel | INCONCLUSIVE | A scripted touch-steering bot (polling every 150 ms at about 8 fps) wall-hits repeatedly on e1/m1; r1 failed to load within 180 s at 2772. This is a bot limitation, not a verdict. Needs a human run on the phone |

New bugs:
B23 | Minor | P2 | Ferrox can't steer onto the Mars r1 landing pad from a 3 m side offset | `node tests/drive.test.mjs` (hauler r1 side ±3 m) | PAD LANDING with control input (works on e1/m1 and for the roadster everywhere) | "miss" both ways with control and "crash" without; the RCS lateral authority is too low in Mars gravity | Open
B24 | Major | P1 | Ultra/High never render at native resolution on the OnePlus 15 (pixelRatio capped at 2) | OP15 emulation 924x424 DPR3, ?q=ultra, start e1, read `__game.pixelRatio`, `__game.drawingBuffer` | Native 2772x1272 on Ultra (RP9) | pixelRatio 2, buffer 1848x848, upscaled 1.5× by the browser, so edges and HUD-adjacent 3D are soft. gfx.js PRESETS ultra/high `dpr: 2`, minScale 0.85 → as low as 1571x721 | Open
B25 | Minor | P1 | Pause and top-right HUD buttons are too small to tap (about 4 mm) | Race at 924x424 DPR3 (r4-dpr3-ultra.png); `#hud` pause box is 59x42 px at 2772 DPR1 ≈ 24x17 CSS at 924 | At least about 9 mm thumb target (RP8) | About 4 mm x 3 mm. Easy to miss or hit the neighbouring restart button | Open

## Fix round 4 (Game Dev, 2026-10-22, against QA regression of f64290d)

| ID | Status | Notes |
|---|---|---|
| B9 | Fixed in 8ff3ed9, re-verified | Title render clean, no floating parts |
| B13 | Fixed in 8ff3ed9, re-verified | Restore codes normalised (normCode), suite green |
| B14 | Fixed in 8ff3ed9, re-verified | No cloud identity on boot; private blobs + /api/forget |
| B17 | Fixed in 8ff3ed9 | HUD legibility; HUD/minimap now drawn at device pixels |
| B21 | Fixed in 8ff3ed9 | Base pads |
| B24 | FIXED | Ultra/High render at native DPR (OnePlus 15 → 2772x1272); DPR 2 cap only for Performance/Medium/Low; dynres floor ≈0.85 of native |
| B25 | FIXED | Touch HUD buttons max(54px,12.5vh) → 9.1 mm on OP15 |
| B6 | FIXED | Jump hover thrust is vertical with horizontal drag; fuel-out fades over 0.9 s. Hauler full hold lands < 60 m past pad (was 126–169 m) |
| B23 | FIXED | Air steer authority raised (steerThrust 1.25, steerGlide 0.4) |
| RP9 haze | FIXED | Title: matte floor, lower mie scattering, no bloom on menu |

Suites: drive 62/62, quests 15/15, simtest roadster 23/23, hauler 23/23, qa.mjs local 31/31, player.browser 15/15.

## Regression round 4 (commit f864d59)
Build: f864d59 built in a fresh worktree (/workspace/volt-roadster-qa-f864d59) to /workspace/vr-dist-f864d59 and previewed on :4173 (the old preview was stopped). The live site serves identical assets (index-oEpgx4tC.js, index-wbqBF5qr.css, three-zySor9gr.js, rapier-BYHDSJ8_.js), so live = f864d59. **Zero live cloud writes this round** (/api/save and /api/forget were routed/blocked; neither was even requested). Scripts: qa/p5.mjs, qa/p5-live.mjs; results in qa/p5*-results.json. tests/drive.test.mjs: 62/62 on f864d59.

| Bug | Status | Evidence |
|---|---|---|
| B24 native DPR | FIXED | 924x424 CSS at DPR 3: Ultra and High pixelRatio 3, drawing buffer 2772x1272 at race start and after 25 s (dynScale stays 1). The code floor is 0.85 (r5-race-dpr3.png) |
| B6 hover glide | PARTIAL (much improved) | Ferrox holding JUMP across e1 (qa/hovergap.mjs MODE=hold): takeoff 135 km/h, hover drag slows it to about 50 km/h, fuel empties at about 4.25 s, lands s=1143. That is 27 m past the pad centre (pad r=9, so a miss but no longer +120 m). Touchdown −14.5 m/s (no input −17.4), scored "BABY CANYON CLEARED", 0 crashes. Fuel-out is still a hard drop |
| B23 Mars pad | FIXED | drive.test hauler r1 ±3 m: PAD LANDING 7.7 m / 5.4 m |
| B25 HUD buttons | FIXED | At DPR 3, horn/radio/cam/respawn/pause are 54x54 CSS = 9.1 mm; pad 28.7, brake 14.3, jump 13.6, boost 11.5, drift 9.3 mm |
| Title haze | FIXED | r5-title-2772.png, r5-title-dpr3.png: no white haze, clean sunset gradient |
| B9 car parts | FIXED | No roof plate or floating mirror/headlight parts (r5-title-2772.png, r5-garage-dpr3.png) |
| B13 restore code | FIXED | Live: " VOLT-QPM5-VG64-XXS9" is kept in full, GET /api/load?code=VOLT-QPM5-VG64-XXS9 restores coins 4242 and gold paint |
| B14 boot write | FIXED | Live fresh boot + 10 s race + quit: 0 /api requests and 0 beacons. Restore made only 1 GET (no save, no forget) |
| B17 HUD labels | FIXED | Level name, km/h, BOOST/THRUST are larger and high-contrast (r5-race-dpr3.png) |
| B21 hex pad | FIXED | r5-base-dpr3.png, all 6 pads whole |
| B19 toast | FIXED for the headline / see B26 | Toasts stay clear of "FINISHED!" but now cover other results content |

RP smoke (f864d59):
- RP1: BRAKE/REV by touch reaches 29.7 km/h in reverse.
- RP2–RP7: drive.test 62/62, including reverse, brake ≤40/45 m, flip 1.27 s, unstuck 2.73 s, respawn 1.61 s, low-speed and mid-speed steering, 1-frame air input, and pad steering on all worlds.
- RP8: pad, jump and boost register together; all clear on release.
- My pause-tap check was inconclusive: my detector read false, so it's a script artefact to recheck.
- No page errors, console clean.

B26 | Minor | P2 | Achievement toasts on the results screen cover the score and the Retry/📷 buttons | Finish e1 for the first time on a fresh save (DPR3 924x424; teleported near the finish with `sim().respawnAt(end-60)` and autoGas) | Toasts in a free area, never over buttons or numbers | "First Finish" covers the SCORE/EARNED row (score value) and part of Retry; "Superstar" covers the 📷 photo button (r5-results-dpr3.png). A tap on Retry/📷 may hit the toast | Open

## Fix round 5 (Game Dev, 2026-10-22, against QA round 4 on f864d59)

| ID | Status | Notes |
|---|---|---|
| B6 | FIXED | Hover drag 0.3→0.5 (scaled by √(g/9.81) for Moon/Mars). Out of gas → reserve burn holds a soft −4.5 m/s descent (fades over 3 s) instead of a drop. Full hold lands: e1 −4.1 m (on pad), m1 +12 m, r1 +3.7 m; max sink ≤ 8.7 m/s; qa/hovergap e1 lands s=1112 (pad 1116) at −4.3 m/s. drive.test now requires within 20 m and sink < 10 m/s |
| B26 | FIXED | Results toasts: compact, top-right corner, max 2 visible, pointer-events:none. Browser test: 0 overlaps with score/buttons (qa-shots/r5-results-toasts.png) |
| Pause tap | VERIFIED | Real CDP touch tap on #btn-pause at OP15 Ultra opens the pause menu (qa-shots/r5-pause-tap.png) |

Suites: drive 62/62, quests 15/15, simtest roadster 23/23, hauler 23/23, qa.mjs local 31/31, player.browser 17/17.

## Regression round 5 (commit f8e68d6)
Build: f8e68d6 built in a fresh worktree (/workspace/volt-roadster-qa-f8e68d6) to /workspace/vr-dist-f8e68d6 and previewed on :4173 (the old preview was stopped). The live site serves identical assets (index-9Z2TgR6y.js, index-BaqPYPtX.css, three-zySor9gr.js, rapier-BYHDSJ8_.js). **Zero live cloud writes** (the live site was only compared by asset hashes). tests/drive.test.mjs: 62/62. Scripts: qa/hover5.mjs, qa/p6.mjs, qa/p6b.mjs, qa/p6c.mjs; results in qa/p6*-results.json.

| Item | Status | Evidence |
|---|---|---|
| B6 e1 full JUMP hold | FIXED | Takeoff 134 km/h, lands s=1111.5 vs pad 1115.6: **−4.1 m**, "PAD LANDING 4.2m" + CLEAN. Touchdown −8.6 m/s |
| B6 r1 | FIXED | Lands 649.5 vs pad 645.8: **+3.7 m**, "PAD LANDING 3.7m". Touchdown −5.9 m/s |
| B6 m1 | OFF PAD | Lands 716.4 vs pad 704.8: **+11.6 m**, beyond padR 9 (2.6 m past the edge). Scored only "CRATER HOP CLEARED" + "CLEAN LANDING", no pad credit and no edge/partial credit. Touchdown −2.9 m/s. Air 14.5 s |
| B6 fuel-out descent | PARTIAL | Descent starts soft but keeps accelerating instead of holding ~4.5 m/s. e1: fuel empties 9.7 m up, vy −1.5→−4.5 after about 1.2 s→−8.6 at touchdown. r1 (8.6 m up): −1.6→−4.6→−5.9. m1: −1.4→−2.9. Only Mars sits near 4.5; Earth doubles it (B27) |
| B26 toasts | FIXED | Fresh-save finish: "First Finish" and "Superstar" stack top-right (x≈830–913, y 1–104 CSS), clear of the score row (y 267). `pointer-events: none` on both the toast and #toasts. Real CDP taps on 📸 (screen → photo) and Retry (screen → race, e2) both go through. elementFromPoint at the button centres = the button |
| Pause tap | PASS | Real touch on #btn-pause: #scr-pause goes hidden → visible, raceTime frozen 0.758→0.758 over 2 s, Resume tap hides it and time runs again (r6-pause-tap.png) |
| RP1–RP8 smoke | PASS | drive.test 62/62 (reverse, brakes, flip, unstuck, respawn, steering, air control, pad steering). Touch: pad + jump + boost + brake all at once (pad −1.0), touchCancel clears everything. No page errors |

Notes:
- The m1 still (r6-m1-pad-edge.png, pickup placed at s=716.4) has the chase camera blocked by a large dark terrain or ramp mass, and the pickup isn't visible. This is possibly an artefact of teleporting; recheck the camera after a real landing there.
- Achievement toasts that fire on results carry over into the next race after Retry and show top-centre (x 413–512, y 59–128) for up to about 3 s, over the battery bar and quest line. Trivial.

B27 | Minor | P2 | Pickup fuel-out descent keeps accelerating on Earth (touchdown −8.6 m/s instead of a soft ~4.5 m/s) | Ferrox, `node qa/hover5.mjs` (hold JUMP across the first gap of e1/r1/m1) | After the gas runs out, a capped soft descent of about 4.5 m/s until touchdown | e1: fuel empties 9.7 m up, then vy −1.5 → −4.5 (≈1.2 s) → −8.6 m/s at touchdown, and keeps growing. r1 −5.9, m1 −2.9 | Open
B28 | Trivial | P2 | Results achievement toasts follow into the next race after Retry, top-centre over the battery bar | Fresh save, finish e1, tap Retry while "Superstar" is showing | Toasts cleared on leaving results, or kept top-right | Toast re-laid at top-centre (413,59 99x69 CSS at 924x424) during the countdown/race for its remaining ~3 s (qa/p6b-results.json) | Open

## Fix round 6 (Game Dev, 2026-10-22, against QA round 5)

| ID | Status | Notes |
|---|---|---|
| B6 m1 | FIXED | Hover drag gravity scale (g/9.81)^0.45. Full hold lands: e1 −3.6 m, m1 +3.3 m, r1 −0.3 m from pad centre (all inside r=9). drive.test now requires inside the pad radius and sink ≤ 5.2 m/s |
| B27 | FIXED | Reserve burn is a gravity-relative controller (g + k·err, cap 1.5 g) with no fade; holds −4.5 m/s on every planet until touchdown (qa/hover5 e1/r1 vy settles at −4.5) |
| B28 | FIXED | Toasts cleared on Retry / any race start |
| m1 camera | VERIFIED + hardened | Real drive from the start line of m1 (no teleport) with a full hold: "PAD LANDING 5.9m", camera view clear before/after touchdown (qa-shots/r6-m1-real-landing.png, tools/m1cam.mjs). Added camera terrain collision anyway: pull in toward the car when terrain sits between them, and never below ground + 0.8 m |

Suites: drive 62/62, quests 15/15, simtest roadster 23/23, hauler 23/23, qa.mjs local 31/31, player.browser 17/17.

## Regression round 6 (commit d0e7bc6)
Build: d0e7bc6 built in a fresh worktree (/workspace/volt-roadster-qa-d0e7bc6) to /workspace/vr-dist-d0e7bc6 and previewed on :4173 (the old preview was stopped). The live site serves identical assets (index-CqJn-fKv.js, index-BaqPYPtX.css, three-zySor9gr.js, rapier-BYHDSJ8_.js). **Zero live cloud writes.** drive.test 62/62. Scripts: qa/hover5.mjs, qa/p7.mjs, qa/p7b.mjs; results in qa/p7*-results.json.

| Item | Status | Evidence |
|---|---|---|
| B6 e1 full hold | FIXED | Lands s=1112.0 vs pad 1115.6 = **−3.6 m**, "PAD LANDING 3.7m" + CLEAN |
| B6 m1 | FIXED | Sim: 708.7 vs 704.8 = **+3.9 m** (claimed +3.3), "PAD LANDING 3.9m". **Real browser flight, no teleport into the gap** (respawn 150 m before the gap, autopilot + held JUMP): identical result, land s=708.7, vy −2.2 m/s, PAD LANDING 3.9m, CLEAN (r7-m1-landing-cam.png: pickup on the pink pad, camera behind it, no clipping) |
| B6 r1 | FIXED | 645.1 vs 645.8 = **−0.7 m** (claimed −0.3), "PERFECT LANDING!" |
| B27 reserve descent | FIXED | e1 vy after fuel-out: −1.5, −2.8, −3.5, −3.9, −4.1, −4.3, −4.4, −4.5 ×5, touchdown −4.5. r1 settles at −4.5, touchdown −4.5. m1: fuel runs out only 2.6 m up, touchdown −2.8 (still ramping toward 4.5) |
| B28 toasts after Retry | FIXED (tiny residue) | Fresh save, finish e1, real-touch Retry. The first poll in the new race still shows "Superstar" (queued second toast); gone within 0.4 s and nothing afterwards |
| Camera collision | PASS with notes | Autopilot 45 s each, per-frame monitor. e3: min clearance above terrain 2.05 m, cam–car 7.8–16.7 m, 1 jump >3 m/frame. m3: 1.03 m, 7.8–16.6 m, 0 jumps. r3: 3.6 m, 0 jumps. 0 frames below terrain on every level. m1 real flight over Crater Hop: clearance ≥4.4 m. r1 gap jump: camera follows down the canyon (clearance 48–66 m over the rift), no clipping. Flip: camera came within 2.1 m of the car for 1 frame, back to 7–11 m within about 1 s. Respawn: single cut (one-frame jump of about 100 m, expected for a respawn), steady afterwards. The game has **no tunnels** (none in levels.js). Collision only tests the terrain heightmap, not track meshes (arches, loops, ramps), but no occlusion showed up in the screenshots |
| RP1–RP8 smoke | PASS | drive.test 62/62. Touch: pad + jump + brake all at once, touchCancel clears everything. No page errors |

B29 | Minor | P2 | Airborne horizon indicator sits dead centre over the car | Any jump or kicker, chase cam (r7-cam-m3.png, r7-respawn-cam.png, r7-flip-cam.png) | Indicator off to the side or translucent, so the car and its landing target stay visible | A 95 px opaque-edged circle covers the car (and on m3 the landing pad ahead) during every airborne moment, which is exactly when the player needs to see the car's attitude | Open
B30 | Trivial | P2 | Landing score popups stack over the car | Real m1 full-hold landing (r7-m1-landing-cam.png) | Popups above the car | Four lines (AIR, CLEARED, PAD LANDING, CLEAN) plus values cover the pickup for about 1 s right after touchdown | Open

## Fix round 7 (Game Dev, 2026-10-22, against QA round 6)

| ID | Status | Notes |
|---|---|---|
| B29 | FIXED | Horizon gauge 96→64 px, 60% opacity, thinner ring, moved to the left edge just above the steer pad. Never over the car or pad (qa-shots/r7-hud-air.png) |
| B30 | FIXED | Score popups sit at 22vh (above the car), newest on top, max 3, smaller, fade in 0.9 s (was 1.5 s). e1 full-hold landing shows all lines above the car (qa-shots/r7-hud-land.png, tools/hudshot.mjs) |
| Camera vs track | DONE | Camera pull-in now also raycasts track pieces: Rapier ray against static colliders (road, walls, loops, ramps, kickers; ~3.5 µs/call) plus a three.js ray against the arches. New drive.test check: road blocks the ray, open sky clear |

Suites: drive 63/63, quests 15/15, simtest roadster 23/23, hauler 23/23, qa.mjs local 31/31, player.browser 17/17.

## Fix round 8 (Game Dev, 2026-10-22): fall-through-world (y ≈ −19 000 on m1)

Root cause (reproduced headless, scratch/rev.mjs): after the race ends on battery the car can still roll/reverse back past the start line, off the end of the road into the void, and nothing respawned it outside the `race` state (crash() is race-only, the −400 m check only ran there too). 120 s of reversing reached y −7 900.

| Fix | Notes |
|---|---|
| Kill plane | `guardWorld()` runs after every physics step in every state (countdown, race, finished/out of battery/results, free roam). Below (lowest terrain/track point − 60 m), outside terrain bounds + 300 m, or a non-finite position → respawn at the last checkpoint with zero velocity, `killplane` event, `stat.killPlane` count |
| Runaway clamp | Linear speed capped at 160 m/s, angular at 40 rad/s (NaN → 0) |
| Back-stop | Invisible wall across the road at s=2 so the car can't reverse off the start end at all |
| Tests | drive.test +9: missed m1 canyon jump + battery-out over 120 s stays above the plane; respawn in countdown/race/finished/free roam; out-of-bounds respawn; velocity clamp; reverse-past-start (both vehicles) stays on the track |

Suites: drive 72/72, quests 15/15, simtest roadster 23/23, hauler 23/23, qa.mjs local 31/31, player.browser 17/17.
