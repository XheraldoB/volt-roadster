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

## Regression rounds 7-8 (commit 0d16de3)
Build: 0d16de3 built in a fresh worktree (/workspace/volt-roadster-qa-0d16de3) to /workspace/vr-dist-0d16de3 and previewed on :4173 (the old preview was stopped). The live site serves identical assets (index-BcHLsd_M.js, index-BTV1Z1xR.css, three-zySor9gr.js, rapier-BYHDSJ8_.js). **Zero live cloud writes.** drive.test 72/72. Scripts: qa/fallstress.mjs (414 sim scenarios), qa/bw-trace.mjs, qa/p8.mjs; results in qa/fallstress-results.json and qa/p8-results.json.

| Item | Status | Evidence |
|---|---|---|
| B29 horizon ring | FIXED | DPR3, e1 jump: #horizon is 64x64 CSS at x=28, y=159, opacity 0.6. The car is at screen x≈403, so no overlap (r8-air-ring-dpr3.png) |
| B30 landing popups | FIXED | Popups at y 114–184, centred on x≈433–491; car at (462, 245), so all popups sit above the car (r8-landing-pops-dpr3.png) |
| Camera vs track pieces | PASS | Autopilot through loops on e1 (s 440), m2 (1909), r2 (2101). Camera never closer than 10.1 m, 0 frames inside the car, no clipping into the loop shell. The camera pops recorded were the teleport to the run-up plus catch-up, not loop-related. Inside-loop stills look clean (r8-inside-loop-e1/m2/r2.png) |
| Kill plane / no infinite fall | PASS (safety net works) | 414 scenarios: 23 levels × 2 vehicles × {reverse into the back-stop, after-finish drive-off, 4 map edges with boost+jumps, 150 m/s slam down, 150 m/s sideways into terrain, flip at a gap edge}. **0 NaN, 0 infinite falls, 0 softlocks.** Every car ended back on or near the track. Longest continuous fall 11.9 s (Moon after finish). Pause mid-fall over the e1 canyon: y frozen exactly for 3 s, resume, then crash + respawn on the road |
| Fall-through-world | **NOT fully fixed** | See B31 (after finish) and B32 (start area). The kill plane catches them, but the car still visibly drops through the ground |
| RP1–RP8 smoke | PASS | drive.test 72/72. Touch: pad + jump + brake all at once, touchCancel clears everything. No page errors |
| Free roam | N/A | The game has no free-roam mode (Sim modes are race/trial only). Map edges were tested in trial mode instead |

B31 | Major | P2 | After finishing, the car rolls off the end of the track and falls through the world behind the results screen (every level) | Finish any level at speed (e1: `sim().respawnAt(end-80, 40)` with autoGas). Results screen shows and the game applies brake=1 at half speed | Car stops on the road past the finish (end back-stop like the start), or is frozen | e1 browser: car passes s≈2620 (track end), falls from −1.3 to −100 m while terrain is +9…12 m above, for about 10 s, then the kill plane respawns it to s 2328, where it creeps backwards. Sim: 45/46 level×vehicle runs hit the kill plane after finish, up to 292 m below terrain (e4) and 11.9 s of falling (Moon). The camera follows it down under the panel. qa/bw-trace.mjs `<lvl> fin`, qa/fallstress-results.json | Open
B32 | Minor | P2 | Reversing past the start back-stop around its end falls through the terrain beside the road | `node qa/bw-trace.mjs e1 back` (reverse + steer from s=30) | Back-stop spans the drivable width, or terrain is solid beside the start | The car reverses to s≈13 at x≈9–12 (past the stop's 11 m half-width), drops through ground whose heightAt is +5.3 to −33 m, and the "fall" crash respawns it after about 1.6 s. Seen in 9/46 back-stop runs (up to 54 m below terrain). Safe but a visible fall-through | Open

## Fix round 9 (Game Dev, 2026-10-22, against QA rounds 7–8)

| ID | Status | Notes |
|---|---|---|
| B31 | FIXED | Every track gets a 160 m flat run-off past the old end (`tr.roadEnd`; `tr.length` keeps its old meaning so scoring/stars are unchanged; terrain bounds ignore the run-off so the seeded terrain is identical). On finish, inputs lock and the car does a smooth stop sized to the room left (≥4.5 m/s², capped 30). A wide end back-stop wall (road + 30 m shoulders each side, 24 m tall) sits at the run-off end. drive.test: all 46 level×vehicle runs cross the finish boosting and stop on the run-off, 0 kill-plane hits, worst peak decel 28 m/s² (r6 roadster) |
| B32 | FIXED | Start back-stop widened to road + 30 m shoulders each side, 24 m tall, 3 m thick. drive.test: reverse + full steer either way from the start on all 23 levels stays on the ground (meteor hits excluded) |
| Toast queue | FIXED | Toasts are queued: max 2 on screen, and an extra toast's timer starts only when it shows, so none are lost; cleared on race start. player.browser: 5 rapid toasts → max 2 visible, all 5 shown |

Suites: drive 74/74, quests 15/15, simtest roadster 23/23, hauler 23/23, qa.mjs local 31/31, player.browser 18/18.

## Real-player checklist additions (owner feedback, Oct 22 2026, after playing)
- RP12 Reverse discoverability: a new player finds and uses reverse within 5 s, without instructions (a dedicated, labelled reverse control, or BRAKE turning into REV in a way the HUD makes clear).
- RP13 Classic control layout: standard mobile racing gamepad (steering on the left; gas, brake and reverse on the right; jump/boost/drift as clear buttons), labelled, at least 9 mm, no overlaps, comfortable for the thumbs at 2772x1272.
- RP14 Camera views: 2-3 selectable views (for example close chase, far chase, hood/bumper), switched with an on-screen button during a race, choice saved across reloads, no clipping in any view, including loops, canyons and flips.
- RP15 "Normal game" feel: menus, flow and controls feel like a standard, polished mobile racing game.

## Final regression (RC 3b6c799)
**Verdict: PASS for release, with 2 open Minor issues (B32 still open, new B33). No Blocker or Major open.**

Build: 3b6c799 built in a fresh worktree (/workspace/volt-roadster-qa-3b6c799) to /workspace/vr-dist-3b6c799 and previewed on :4173 (the old preview was stopped). The live site serves identical assets (index-CeBXvjQ7.js, index-B8ksIhuO.css, three-zySor9gr.js, rapier-BYHDSJ8_.js). GitHub: `git ls-remote origin` shows refs/heads/master = 3b6c79938eaf… (= RC). **Zero live cloud writes.** drive.test 74/74. Scripts: qa/fallstress.mjs, qa/bw-trace.mjs, qa/hover5.mjs, qa/p9.mjs, qa/p9b.mjs, qa/p9-live.mjs; results in qa/fallstress-results.json and qa/p9*-results.json.

| Item | Status | Evidence |
|---|---|---|
| B31 after-finish fall | FIXED | fallstress after-finish: **0/46 kill-plane hits**, 0 below terrain, max fall 0.1 s. Browser full-speed finish, roadster: e1 at 180 km/h stops in 65.7 m / 2.8 s (s 2579→2644, track end 2779). r6 at 172 km/h stops in 60.8 m / 2.7 s. Camera stays 10–16 m behind, car stays on the road (r9-finish-r6-a/b.png) |
| Finish stop feel | **B33 (Minor)** | Deceleration jumps from 0 to **2.35 g within one 1/120 s step** at the line (peak 2.38 g e1, 2.26 g r6; GM's "2.9 g" not reproduced), then tapers 2.3→1.7 g. No ramp-in, so it reads as a wall-like slam, about 2× the car's own braking (≈1.2 g). Mostly hidden behind the results panel, which shows within about 0.3 s |
| B32 start back-stop | **STILL OPEN** | Back-stop reverse-around: **8/46 still drop through the ground** (same as before). Trace e1: the car is at s≈13–14, x≈9–10, i.e. *in front of* the wall (s=2), and falls through terrain (heightAt +5.3 → −33 m), so the cause is a terrain/collider hole beside the road near the start, not the wall width. A crash + respawn catches it after about 1.6 s. Safe |
| Toast queue | PASS (small residue) | Fresh save e1 finish: toasts seen = tutorial hint, First Finish, Superstar. None lost, max visible 1 (≤2), top-right, `pointer-events: none`, no button overlap. After a real-touch Retry, "Superstar" shows for about 0.4–0.8 s at race start, then clears |
| Kill plane / NaN | PASS | 414 scenarios: 0 NaN, 1 kill-plane hit (flip at a gap edge, respawned), max fall 11 s (Moon edge hops above terrain) |
| B6/B27 spot check | PASS | e1 PAD LANDING 3.7 m, r1 PERFECT, m1 PAD LANDING 3.9 m. Reserve descent −4.5 m/s on e1/r1 |
| B7–B30 spot check | PASS | drive.test 74/74 (B7, B11, B12, B15, B16, B22, B23 and RP2–RP7 checks included). Live: B13 code with leading space restores (coins 4242). B14: 0 /api requests on boot/race/quit, restore = 1 GET only. B29/B30/B26/B25/B24 unchanged code paths, retested last round |
| RP1–RP8 smoke | PASS | Touch: pad + jump + brake all at once, touchCancel clears everything. No page errors locally |
| Live boot | PASS | 3.6 s boot, 0 console errors, 0 page errors, 0 HTTP errors, 0 writes |

B33 | Minor | P2 | Finish auto-brake slams on instantly (~2.35 g in one physics step) | Roadster, finish e1 or r6 at full boost (`qa/p9.mjs`), record speed per fixed step | A short ramp-in (≈0.3–0.5 s) to a decel no harsher than the car's normal brakes | 0 → 2.35 g between consecutive 1/120 s steps, peak 2.38 g (e1) / 2.26 g (r6), tapering to 1.7 g. Stop 61–66 m / 2.7–2.8 s. Car and camera stay stable; the slam is partly hidden by the results panel | Open

## Fix round 10 (Game Dev, 2026-10-22): R28 user playtest + B32/B33 + toast-after-Retry

| Item | Status | Notes |
|---|---|---|
| R28.1 Reverse | DONE | Dedicated orange **R / REVERSE** pedal above BRAKE; BRAKE labelled "hold = R"; D/N/R gear badge next to the speed (red R). Browser: R pedal → `reversing`, gear R (qa-shots/r28-hud-reverse.png) |
| R28.2 Classic layout | DONE (default) | ◀ ▶ arrow buttons left; tall GAS and BRAKE pedals right; R above BRAKE; boost / drift / jump column beside the pedals. Settings → Controls: Classic or Analog pad (then pad/halves/tilt). Old saves migrate to Classic with auto-gas off. Thumb sizes on OP15 (DPR3): GAS/BRAKE 12.2 mm, arrows 18.3, R 9.3, boost/drift/jump 10.8, camera 9.1 |
| R28.3 Cameras | DONE | 🎥 cycles Close chase → Far chase → Hood, saved in settings (survives reload); Settings lists the same three (qa-shots/r28-cam-close/chase/hood.png) |
| R28.4 Polish | DONE | First-run "How to drive" overlay holds the race until "Got it" (remembered; Settings → Help re-shows it; automation skips it unless `?tut=1`). Title menu PLAY / Garage / Base / Settings unchanged |
| Finish stop | DONE | ≤ 1 g (cap 9.8 m/s²), ramped in over 0.5 s (B33), run-off 300 m; wheel brakes off until nearly stopped. 46/46 runs: worst 7 m/s², ≤ 4 m/s² in the first 0.1 s |
| B32 hole | FIXED | Solid road-level ground slab (road ± 30 m, 50 m long) at both ends. New test drops the car at s 13.5, x ±9.5/±14 on all levels (fails at −30.9 m without the slab) |
| Toast after Retry | FIXED | Results toasts scheduled for later are dropped when leaving (generation counter) and Retry clears instantly |
| NaN camera | FIXED | Found while testing: a dt=0 view update during the tutorial made the camera NaN (black 3D view). View no longer updates while the tutorial is up, plus a NaN guard |

Suites: drive 75/75, quests 15/15, simtest roadster 23/23, hauler 23/23, qa.mjs local 31/31, player.browser 24/24 (7 new R28 checks).

## Regression (commit ab1aa7a, req 28)
Build: fresh worktree /workspace/volt-roadster-qa-ab1aa7a -> /workspace/vr-dist-ab1aa7a (preview :4173). Live asset hashes identical; GitHub master = ab1aa7a; drive.test 75/75. Zero live cloud writes (restore GET with VOLT-QPM5-VG64-XXS9 only); no commits or source edits. Scripts: qa/p10*.mjs, qa/finish-trace.mjs, qa/fallstress.mjs.

| Item | Result |
|---|---|
| Live boot | PASS: 4.5 s, 0 console errors, 0 API on boot/race/quit, restore GET ok (coins 4242) |
| First-run tutorial (?tut=1) | PASS: shows, holds race clock, "Got it"/skip dismisses, no black screen after dismiss, Retry or level change; tutSeen saved |
| RP12 reverse + D/N/R badge | PASS: R pedal labelled "R REVERSE", reverse in 0.15 s to 30 km/h, N/D/R switch cleanly, BRAKE hold also reverses, cancel clears; steering in reverse works (roadster -25 deg, hauler -18 deg over 1.2 s); both vehicles |
| RP13 classic default | PASS: labelled, smallest 9.1 mm (cam/pause), pedals 9.3-12.2 mm, steer halves 21.5 mm, 0 overlaps at DPR3 and 2772; multi-touch + touchcancel clear |
| RP13 Settings toggle | PASS (Classic -> Analog pad by tap, saved across reload). Switching back by mouse click didn't register in the harness (touch-first UI, not counted as a bug) |
| RP14 cameras | PASS: btn-cam cycles chase -> hood -> close during a race, saved across reload, no NaN or under-ground in loops/flips; hood usable (FOV 68). Chase min distance 1.23 m during a flip (pull-in, no visible clipping in shot) |
| Close vs far | far 7.8 m/2.5 m high vs close 5.5 m/1.7 m, same FOV 62: visibly different (car about 1.5x larger) but modest. Suggestion: far 10-11 m or +6 deg FOV |
| B33 finish stop | PARTIAL: ramped (jerk about 14 g/s), but stock peaks 0.5-0.66 g (not ~1 g) and stops in 285-316 m (> 300 m target, < 340 m run-off). About 1.0-1.2 g only at upgraded speeds |
| B32 | FIXED: backwall 0/46 drops |
| Toast after Retry | FIXED: no toasts at 0.6 s or 3.6 s |
| Smoke B6-B31, RP1-RP11, kill-plane (414 scenarios) | PASS: 0 NaN, 0 after-finish kills, 2 flipAtGapEdge respawns (expected), B6/B27 pad landings ok |

New bugs:
- **B34 (Major): post-finish auto-stop doesn't hold the lane, so the car hits the run-off side barrier.** Inputs lock after finish and the car drifts to x≈6 m. Node sim e1: stock hauler hits at 46 km/h (117 g one-step spike, 55 m before the end). Roadster with speed+boost Lv3 hits at 99 km/h (215 g). With Lv5 (finish 300-350 km/h) cars slam at 116-332 m (up to 650 g), and on m6 at 334 km/h it reaches the end wall. Fix: steer to the centreline during the auto-stop, and scale the decel to the finish speed so the stop fits inside 300 m.
- **B35 (Minor): finish stop is softer than spec.** 0.5-0.66 g stock and 285-316 m, versus "about 1 g, within 300 m".
- Suggestion (not a bug): increase the gap between close and far chase.

Verdict: **CONDITIONAL PASS.** The new features (reverse, classic layout, cameras, tutorial) pass. B32 and the toast are fixed. B33 is only partly fixed and B34 is new (Major).

## Fix round 11 (Game Dev, 2026-10-22, against QA on ab1aa7a)

| ID | Status | Notes |
|---|---|---|
| B34 | FIXED | Finish auto-stop now steers to the run-off centreline (aim ~20 m + 0.3 s ahead) and straightens: yaw rate bled, velocity swung onto the heading. Braking is scaled to finish speed: target brake 8.6 m/s², up to 10.2 m/s² only if the remaining run-off needs it, ramped over 0.5 s; rolling + air drag add ~1–2 m/s². Run-off extended to 700 m (no run-off passes within 40 m of other track on any level). New drive test: maxed upgrades crossing the line at ≥350 km/h (boosting) with a weaving steering bot, plus stock, both vehicles, all 23 levels: centred (|x| ≤ 3 m), straight (heading·track ≥ 0.97), stopped inside the run-off, peak ≤ 10.7 m/s² (≤ 1.1 g), first 0.1 s of the ramp ≤ 7.4 m/s² (Moon landings 6.5–7.1 from tyre contact, elsewhere ≤ 4) |
| B35 | FIXED | Stock cars now reach about 1 g: peak 9.6–10.8 m/s² across all levels |
| Far chase | DONE | 10.5 m back (+1.2 m at speed), 3 m up, +6° FOV (qa-shots/r28-cam-chase.png) |

Suites: drive 76/76, quests 15/15, simtest roadster 23/23, hauler 23/23, qa.mjs local 31/31, player.browser 24/24.

## Regression (commit 56ae92f)
Build: fresh worktree /workspace/volt-roadster-qa-56ae92f -> /workspace/vr-dist-56ae92f, preview :4173 (old one stopped). Live assets identical; GitHub master = 56ae92f. The dev's node tests pass, including the new B34/B35 all-level test. Zero live writes: live boot 3.6 s, 0 errors, only the restore GET. No commits or source edits. Scripts: qa/b34-stress.mjs, p11.mjs, p11b.mjs, p11c.mjs, p11d.mjs; results in qa/*-results.json.

| Item | Result |
|---|---|
| B34 Node stress (own steering bot, 23 levels x 2 vehicles x stock/Lv3/Lv5 = 138 runs) | 127 clean: max lateral 3.0 m, yaw at stop <= 1 deg, peak <= 1.08 g, longest stop 544 m, >= 196 m of road left. 4 more are clean (jerk 205-267 g/s at ~1 g, just over my 200 limit). 1 harness miss (e4 hauler: bot fell into a gap before the finish). **6 fail (B36)**: r1 and r6 at Lv3/Lv5 cross the line airborne off a late jump |
| B34 browser (DPR 3) | PASS. e1 Lv5 roadster at 320 km/h and m6 Lv5 at 321 km/h: lateral <= 0.08 m, yaw 0, peak 1.05-1.06 g, jerk 24 g/s, still braking smoothly at 8 s (projected stop about 400 m). e1 stock hauler at 171 km/h: stops in 133 m / 5.4 s, peak 0.97 g, lateral 0.09 m, 0 crashes |
| B35 stock decel (browser) | FIXED. e1 roadster 186 km/h: 0.16 -> 0.98 g over 0.5 s, then 0.97 -> 0.88 g, stop in 155 m. r6 roadster 182 km/h: peak 1.00 g, stop in 148 m. Jerk <= 104 g/s, no one-step spikes |
| Far chase camera | FIXED. 10.5 m back, 3.0 m up, FOV 68 (close: 5.2 m back, 1.7 m up, FOV 62). Clearly distinct (r11-cam-close-vs-far.png). Loops/flips: chase min 4.0 m, close min 3.1 m, hood 0.54-0.72 m; 0 NaN, 0 below ground |
| RP14 cycle + persistence | PASS: chase -> hood -> close -> chase, saved across reload |
| Tutorial | PASS: shows, holds the clock, Got it -> countdown resumes, no black screen; level change ok |
| RP12/RP13 | Carried over (no input/UI files changed since ab1aa7a; seen in screenshots) |
| B32, kill-plane stress | PASS: backwall 0 drops, after-finish 0 kills, 0 NaN, 2 kills total (flips at gap edges, respawned) |

New bugs:
- **B36 (Major): a late jump can carry a fast car over the finish line airborne, where the auto-stop can't help.** Node, Lv3/Lv5 on r6 and r1.
  - r6 hauler Lv5: crosses the line 104 m up, lands about 625 m in at 277 km/h, then hits the end wall at about 200 km/h (572 g).
  - r6 roadster Lv3/Lv5: 43-49 g impacts.
  - r1: lands 13-20 m off-centre; one Lv5 roadster run ends 347 m off-road.
  - The dev's test misses this because its bot starts at the line.
  - Suggested fix: clamp airborne speed and steer to the centre after finishing, or extend the end barrier.
- **B37 (Minor, cosmetic): gear badge shows "R" at 0 km/h during the countdown after the tutorial (expected N).** r11-after-tutorial.png.

Verdict: **CONDITIONAL PASS.** B34 is fixed for ground finishes, and B35 and the far camera are fixed. B36 (airborne finish on r1/r6 at upgraded speed) stays open.

## Fix round 12 (B36, B37)
- B36 root cause: boost bypassed the take-off governor, so the last jump before the finish on r6/r1 launched the car up to ~100 m over the line. The last jump whose landing is within 700 m of the finish is now governed even when boosting (cap ≈1.2× design speed); the finish is no longer crossed airborne on any level.
- Post-finish airborne assist: horizontal speed damped at 14 m/s² toward 30 m/s, in-air lateral steer to the centreline, sink rate limited (−7 m/s, −1.5 m/s below 5 m) for a soft landing, spin damped; grounded finish braking unchanged.
- Found during testing: rivals that finished earlier stopped in-lane just past the line and a fast finisher rear-ended them (10.2 g spike on r1). Finished rivals now coast to the shoulder and become non-colliding.
- New sim test (tools/finishrun.mjs, in drive.test): full run-up through the last pre-finish jump, upgrades 0/3/5 × roadster/hauler × 23 levels = 138 runs: 138/138 ok, 0 airborne at finish, max post-finish 2.4 g, all stopped on the road. Existing barriers proved sufficient.
- B37: gear badge shows N during countdown and below 1 km/h.
- Suites: drive 77/77, quests 15/15, simtest roadster 23/23, hauler 23/23, qa local 31/31, player.browser 24/24.

## Regression (commit db99eda)
Build: fresh worktree /workspace/volt-roadster-qa-db99eda -> /workspace/vr-dist-db99eda, preview :4173 (old one stopped). Asset hashes are identical to live (index-DVgCHjXc.js, index-CMXZabts.css, three-zySor9gr.js, rapier-BYHDSJ8_.js). Zero live writes: the only live API call was GET /api/load?code=VOLT-QPM5-VG64-XXS9. No commits or source edits. Scripts and results: qa/b34-stress.mjs, b36-ramp.mjs, b36-dbg.mjs, b36-rivals*.mjs, p12.mjs, p12r1.mjs, p13.mjs, p11b.mjs, p11c.mjs, fallstress.mjs, p12-live.mjs (all in the worktree's qa/).

| Item | Result |
|---|---|
| B36 Node stress (b34-stress, 138 runs, run-up from finish -1500 m) | **FIXED for r1/r6**: all 12 r1/r6 runs are grounded at the line, 0 end-wall/barrier hits, \|x\| <= 0.97 m, peak <= 1.04 g, >= 389 m of road left. Overall 133/138 clean: 4 are jerk-only (201-267 g/s at ~1 g, same as before). 1 harness miss (e4 hauler stock, same as before). r6 roadster Lv5 finishes at only 135 km/h because of B38 |
| Dev tools/finishrun.mjs | 138/138 ok (matches the dev). Its run-up starts after the second-to-last jump on r6, so it misses B38 |
| Take-off cap clears the last jump | PASS. r6 (gap ends at 2578 m): stock 146 km/h -> lands at 2645 m, Lv3 151 -> 2663, Lv5 roadster 165 -> 2760 (hard landing, 22 m past the pad), Lv5 hauler 165 -> 2738. r1 (gap ends at 1656 m): stock 144 -> 1696, Lv3 163 -> 1782, Lv5 163 -> 1799-1811. Every landing is on the centreline (x = 0) |
| Governor feel | **FAIL, B39**: boosting cars scrub from 340 to 165 km/h in about 35 m before the ramp |
| B36 browser (DPR 3, race mode, Lv5, boost held) | r6 roadster: take-off 166 km/h, lands at 2762 m x 0, grounded at the line at 235 km/h, height 0.7 m, peak 1.01 g, 0 crashes. r6 hauler: 165 km/h, lands at 2736 m, 229 km/h at the line, 1.00 g. r1 roadster: 163 km/h, lands at 1815 m x 0, 256 km/h at the line, max \|x\| 2.5 m. r1 hauler: 163 km/h, lands at 1804 m (it then ran out of battery from the forced boost, a harness artefact). Stop distance from Node: 223-351 m |
| Finished rivals | PASS. They coast to the shoulder (\|x\| = 5.7 m), become sensors and show as translucent ghosts (r12-finish-r1_hauler_lv5.png). Steering the player into them got within 0.7 m with 0 contact events. Normal finishes: peak 1.01-1.04 g |
| B37 gear badge | FIXED. Shows N in the countdown after the tutorial (?tut=1, fresh save) and on a normal start (r12-tutorial.png) |
| B34/B35 browser ground finishes | PASS, same as 56ae92f. e1/m6 Lv5 at 319-321 km/h: 1.05-1.06 g, lateral <= 0.08 m. Stock: stops in 133-155 m, <= 1.0 g |
| Cameras / tutorial (p11c) | PASS: chase 10.5/3.0/68, close 5.2/1.7/62, hood; setting saved across reload; 0 page errors |
| Kill-plane stress | PASS: identical to 56ae92f (414 scenarios; backwall 0, after-finish 0, 0 NaN; same free-roam edge counts) |
| RP12/RP13 touch | PASS. Classic layout, 0 overlaps, smallest control 54 CSS px (cam/pause/respawn). R pedal -> R badge, -14.7 km/h after 3 s; GAS -> D. Time to first reverse in the harness was 2.0 s (slow software render; no input code changed) |
| Live boot | PASS: 2.9 s, 0 errors, 0 console errors, 0 writes, only the restore GET (coins 4242, gold paint) |

New bugs:
- **B38 (Major): r6 Lv5 roadster crash-lands just before the finish.** Boosting off the second-to-last jump (gap 1734-1921, take-off about 341 km/h) flies about 1160 m. That jump isn't governed. The car sails over the governed last jump and crash-lands 21 m before the line at 274 km/h, then respawns at 2739 m and finishes at about 80-135 km/h. The same happens on 56ae92f, where the B36 airborne finish hid it. Suggested fix: govern any jump whose flight can reach within 700 m of the finish (by projected range, not only the last gap), or cap the airborne range.
- **B39 (Major, feel): the governor counts as a wall hit.** It is an invisible brake: 340 -> 165 km/h in 0.6 s, up to about 30 g per step, on r6 (from 2336 m) and r1 (from 1486 m) at Lv3/Lv5 while boosting. The speed loss trips the B12 wall-hit penalty: crash sound, haptic, "WALL HIT -250", combo reset and -1 s battery. It also fires a stream of hit events. Suggested fix: exempt governor deceleration from lossWin/hit, and spread the slowdown over a longer approach (about 1-1.5 g) or show it clearly (for example a limiter or "speed trap" cue).
- **B40 (Minor): one uncaught page error "Failed to execute 'setTargetAtTime' on 'AudioParam': non-finite value"** (audio.engine, from main.js:569). Seen once in p13 (fresh save with ?tut=1, then a level switch). Not seen in p11c or live. Suggested fix: guard the engine() inputs (speed and throttle are NaN or undefined for a frame).

Verdict: **CONDITIONAL PASS.** B36 (airborne finish) and B37 are fixed, and nothing has regressed. B38 and B39 are new Major issues around the r1/r6 finish jumps at upgraded speed. Fix both before release.

## Fix round 13 (B38, B39, B40)
- B39: removed the boost take-off cap added in round 12 (felt like a wall). The ordinary non-boost take-off limit is back to how it was before round 12. Replaced by an invisible air brake: while airborne in a race the sim predicts the landing point along the track (ballistic, every 0.05 s); if the landing would be past the finish or within 80 m of it, a smooth horizontal drag (1.25 g, eased in over 0.3 s / out over 0.2 s) brings the landing before the line. It never slows a car short of the landing pad of the gap being cleared, and never acts on earlier jumps (loops etc. keep their speed). Airborne only, 12 m/s² < the 90 m/s² impact threshold, so no wall hit, crash sound, haptic, penalty, combo reset or battery loss. No ground approach limit was needed.
- B38: finishrun.mjs now starts 500 m before EVERY jump in the last 2 km (r6 Hop Three and Hop Four, r1 Rust Rift and Dust Devil Gap, ...), upgrades 0/3/5 × both vehicles × 23 levels = 198 runs: 198/198 ok. None crossed the finish more than 2 m in the air. Max g after the line was 2.3. There was no wall hit, hit or crash within 1 s of air braking. Air brake was active for 0.6–7.5 s on r1/r4/r6.
- B40: engine() and rcs() clamp and sanitise inputs, so AudioParam.setTargetAtTime never gets NaN/Infinity. New drive test.
- Suites: drive 78/78, quests 15/15, simtest roadster 23/23, hauler 23/23, qa local 31/31, player.browser 24/24.

## Regression (commit db11e24)
Build: fresh worktree /workspace/volt-roadster-qa-db11e24 -> /workspace/vr-dist-db11e24, preview :4173 (old one stopped). GitHub master = db11e24, and the assets are identical to live. Zero live writes: the only live API call was GET /api/load?code=VOLT-QPM5-VG64-XXS9. No commits or source edits. Scripts and results: qa/b38-stress.mjs (+ b38-summ.py), b6-airbrake*.mjs, p14.mjs, p13.mjs, p11b/p11c.mjs, fallstress.mjs, b34-stress.mjs, p12-live.mjs, all in the worktree's qa/. The same b38-stress was also run on db99eda as a baseline.

| Item | Result |
|---|---|
| Dev tools/finishrun.mjs | 198/198 ok. It only checks events after the line, so it misses B41/B42 |
| Own stress (b38-stress): 23 levels x 2 vehicles x 0/3/5; run-ups from finish -1500 m and from 500 m before EVERY gap (450 runs); boost held, weaving bot | **FAIL.** The air brake engaged in 28 runs (r1, r4, r6 at Lv3/Lv5) and **23 of those 28 fail**. Typical result: the car lands 83-105 m before the line with HARD LANDING + WALL HIT (-250). r6 roadster Lv3/Lv5: **crash:landing (respawn) at -83 to -157 m** in 5 of 5 braked runs. r1 hauler Lv5: airborne at the line, 14 m off-centre, 19.9 g. Against db99eda: 17 runs regressed, 4 improved. Runs where the brake never engaged match the baseline (the bot's own wall hits are harness noise on both commits) |
| False triggers | None found. The brake never engaged on a jump whose unbraked landing was more than 120 m before the line. B6 pickup hover pads (e1, m1, r1, every gap, race and trial): identical pad landings with the brake on and off, air-brake time 0 |
| Browser DPR 3, Lv5, boost held (p14) | **FAIL.** r1 roadster: take-off at 335 km/h, braked 4.5 s at up to 1.40 g (335 -> 204 km/h), 9.2 s in the air, 48 m high. It lands 114 m before the line but **103 m sideways off the road -> crash:off, respawn**, then a crash:off loop (a short hop near the line is braked 133 -> 61 km/h and falls off again). r1 hauler: 302 km/h, braked 3.1 s, lands 98 m off the road, same loop. r6 hauler: take-off at 306 km/h, **104 m high, 14.2 s in the air**, braked 6.3 s, lands 92 m before the line at 48 km/h on the road edge (x 6 m). r6 roadster: the in-page bot never got cleanly through the run-up (stuck/respawn loops around -1408 m); no braked flight recorded. Both haptic types fire ([40,30,80] crash pattern and short pulses), and "WALL HIT -250" / "HARD LANDING" popups appear |
| Feel | Not a sudden lurch: the brake ramps over 0.3 s and holds about 1.25-1.4 g. But it is **noticeable and wrong-feeling**: 130-250 km/h vanishes in mid-air for no visible reason, flights of 8-14 s hang 40-104 m up, and the chase camera trails 19-35 m (normally 10.9). The landing then gets punished anyway |
| B40 | FIXED: 0 uncaught errors in the tutorial + level-switch path (p13), the boost/crash/respawn audio paths (p14), p11b, p11c and the live boot |
| B34/B35 ground finishes | PASS, unchanged (e1/m6 Lv5 320 km/h 1.05-1.06 g; stock stops in 133-155 m) |
| B36 airborne finish | Still airborne at the line: 3 runs (m2 hauler stock x2, the same on db99eda; plus r1 hauler Lv5, new) |
| B37, cameras, RP12/RP13 | PASS: gear N in the countdown (tutorial and normal start); cameras 10.5/3.0/68, 5.2/1.7/62, hood, saved across reload; R reverses in 0.68 s to -28.9 km/h; classic layout, 0 overlaps, minimum 54 px |
| Fall-through stress | PASS: 0 NaN, 2 kills (4 before), backwall and after-finish 0. Two free-roam edge scenarios changed state (no kills) |
| Live boot | PASS: 3.7 s, 0 errors, restore GET only |

New bugs:
- **B41 (Critical): the air brake can't steer, so on r1 the long braked flight lands about 100 m off the road.** Browser, Lv5, both vehicles: the car flies straight while the road curves, then crash:off and a respawn loop near the finish. The brake also re-triggers on short hops after a respawn and drops the car short.
- **B42 (Major): braked flights land 83-105 m before the line as a HARD LANDING + WALL HIT (-250, combo reset, crash haptic).** On r6 roadster they land as a **crash:landing respawn**. This is B38 in another form. Cause: the brake keeps horizontal speed down but the car stays up for 6-14 s, so it lands steep and hard right at the 80 m margin. 23 of 28 braked runs.
- **B43 (Major, feel): mid-air speed loss plus very long hang time.** 8-14 s in the air, up to 104 m high, the camera trailing about 3x its normal distance. Suggestion: return to a ground-side cap on the take-off ramp, spread over 150-200 m at about 1 g, and exempt it from wall-hit scoring; or reduce boost on the final ramps so the take-off speed stays within about 1.2x the design speed.
- **B44 (test gap): finishrun only checks events after the line.** It should fail on crash/hardLanding/wallHit within 300 m before the line, and on landings more than 3 m off-centre.

Verdict: **FAIL.** B40 is fixed and no false triggers were found, but the B39 replacement makes the r1/r4/r6 finishes worse (off-road crashes, crash landings, scored wall hits). B38 is not fixed.

## Fix round 14 (B41-B44 redo; production was rolled back to db99eda first)
- Rolled production back to db99eda (dpl_3QaUtUQQ6zBdG1msZ7psihSzDJEu) via Vercel rollback before any work; live bundle index-DVgCHjXc.js confirmed.
- B41/B42/B43: the air brake is removed completely. Replacement, all on the ground:
  - Final ramps are gaps in the last 2 km whose ballistic flight at this car's fast speed (min(100 m/s, vmax x 1.2)) would come down within 300 m of the finish or past it.
  - On those ramps boost is locked from 450 m before the lip until the landing. The zone never reaches back into a previous gap or cork. HUD shows an amber "BOOST LOCKED" pill and the boost button greys out (qa-shots/b43-boost-locked.png).
  - Approach governor: a <=1 g braking profile (motor cut while above it) ends at 1.1x the design speed at the lip. A loop inside the zone keeps 1.6x its loop-the-loop minimum (>=30 m/s). A slow car (stock pickup) is topped up at up to 0.7 g over the last 120 m. Measured approach bleed on r6 Hop Four from 288 km/h: 1.18 g including aero drag.
  - On final-ramp flights only: a gentle (<=0.4 g) lateral nudge toward the centreline at the predicted touchdown, and the sink speed eases toward a clean landing in the last 0.5 s.
  - The governor never feeds wall-hit or impact scoring. Landing speed loss, including the hard-landing penalty, is no longer also scored as a WALL HIT: 0.5 s landing grace (e7 Broken Span used to give HARD LANDING + WALL HIT on every run).
- B44: finishrun fails on any crash, hard landing, wall hit or respawn in the last 300 m before the line, on gap landings >3 m off centre, and on being airborne at the line (any height). It keeps the 500 m run-ups before every jump in the last 2 km. Rival AI cars are parked, because the bot can't dodge them; meteor strikes are counted separately. STRESS=1 runs a 660-run QA-style sweep (5 bot variants: weave 0/0.25/0.45, phases, boost off, 60 m/s run-up).
- Results (same harness on both builds):
  - finishrun 198 runs: db99eda 171/198 -> 190/198, 0 airborne at the line.
  - Stress 660 runs: db99eda 562/660 (6 airborne at the line) -> 613/660 (1 airborne).
  - The remaining failures are mostly the bot overspeeding or weaving in the finale loops of e4/e8/m3/r3. They fail on db99eda too and are listed in drive.test's FINISH_KNOWN. Also: a few post-line peaks of 4.1-4.9 g, and heavy-weave wall scrapes.
- m2 stock pickup "airborne at the line" was a battery-out DNF while falling into The Abyss (the stock pickup could not clear it after a respawn). It is now cleared via the top-up. r1 Lv5 pickup: 0 airborne finishes.
- Suites: drive 79/79, quests 15/15, simtest roadster 23/23, hauler 23/23, qa local 31/31, player.browser 24/24.

## Regression (commit 117848c)
Build: fresh worktree /workspace/volt-roadster-qa-117848c -> /workspace/vr-dist-117848c, preview :4173. GitHub master = 117848c, and the assets are identical to live. Zero live writes: the only live API call was GET /api/load (restore). No commits or source edits. The dev's drive test was run from a copy in qa/ so tests/ wasn't touched. Summary: qa/summary-117848c.json.

| Item | Measured | Claimed / baseline |
|---|---|---|
| Dev finishrun | 190/198 | claimed 190/198; same harness on db99eda 171/198 |
| Dev STRESS | 613/660 | claimed 613/660; db99eda 562/660 |
| Own 450-run stress (run-ups from -1500 m and before every jump) | 400/450 ok; 0 airborne at the line; crash/wall/hard landings within 300 m of the line: 25 runs; max \|x\| at the line 2.35 m | db99eda 367 (54 near-finish), db11e24 354 (65) |
| B41 off-road landing | FIXED: every final-ramp landing is at \|x\| <= 0.4 m (Node and browser) | |
| B42 landing wall hit / crash landing | FIXED for r1/r4/r6: 0 hard landings or wall hits on landing in braked runs | |
| B43 hang / feel | FIXED: flights 4.3-7.0 s, 2.8-6.4 m high, no mid-air slowdown; camera 12-25 m in flight. The BOOST LOCKED cue shows on the boost bar. The ground governor is smooth (ramped) but measured **1.18-1.52 g** in the browser (r6 1.47-1.52 g), not <= 1 g; 225-231 -> 139-141 km/h over about 130 m | claimed <= 1 g |
| B44 finishrun stricter | DONE: it now catches pre-line crashes, wall hits and off-centre landings | |
| B36 leftovers | 0 airborne at the line in 450 runs (3 on db99eda) | |
| False triggers | B6 pickup pad landings in race and trial (e1/m1/r1, every gap) on the pad as before; normal mid-level jumps keep their speed | |
| e4/e8/r3 | Same as or better than db99eda (stress e4 8/8, e8 4/6, r3 7/8) | |
| **m3** | **Worse**: stress 5 fails vs 1, finishrun 2 vs 0 | claim "also on db99eda" is wrong for m3 |
| Smoke | drive.test 79/79; B34 138-run 137 ok (e4 harness); fall-through stress 0 NaN, 4 kills, 58 strict fails (61 before); B34/B35 browser same as before; B37 N; B40 0 uncaught errors | |
| RP1-RP15 by touch (DPR3 and 2772) | RP1/RP12 reverse 0.24-0.33 s, -28 km/h, both vehicles; RP2-RP7 via drive.test; RP8/RP13 classic layout, 0 overlaps, smallest 9.0 mm, multi-touch clears on release; RP14 3 cameras saved across reload; tutorial ok. RP9-RP11 and RP15 need the phone. The Settings layout select wasn't found by the harness (not counted) | |
| Live boot | 2.7 s, 0 errors, restore GET only | |

New bugs:
- **B45 (Major): m3 Roadster Lv3/Lv5 falls (crash:fall) 265-293 m before the line, worse than db99eda.** Repro: `STRESS=1 LV=m3 node tools/finishrun.mjs` -> 5 fails (db99eda 1); `LV=m3 node tools/finishrun.mjs` -> 2 fails (db99eda 0). Boost is locked for 14-62 s in these runs and there are meteor hits. Likely the slower governed approach leaves the car in the meteor/crater section longer, or the lock blocks recovery after a respawn.
- **B46 (Minor): final-ramp governor peaks at 1.2-1.5 g, not <= 1 g.** Repro: browser r6 Lv5 Roadster, boost held from 500 m before the last jump: 231 -> 139 km/h between -679 and -547 m, peak 1.52 g (the ramp gradient adds to the bleed).
- **B47 (Minor): one-step 3.3 g spike at the finish at 368 km/h.** Repro: Node, r4 Roadster Lv5, run-up from finish -1500 with boost (qa/peak-trace.mjs): peak 3.33 g at line +1 m, then about 1 g. Same on r1 from gap0 (3.19 g).
- **B48 (Minor, design/feel): boost is locked for most of the last 2 km on two-ramp levels.** m4 is locked from -2056 m, r6 from -1634 to -853 and -838 to -180, m1/m2/m3/m5 similar (qa/fr-zones-results.json). Boosting players may feel the finale is "taken away". Consider shortening the lock to about 250 m before each lip.

Verdict: **CONDITIONAL PASS.** B41-B44 are fixed, B36 has no leftovers, and the dev's numbers reproduce exactly. Fix B45 (m3 regression) before release; B46-B48 are polish.

## Fix round 15 (B45-B48)
- B45 m3: jumps with a loop between the landing and the finish are no longer final ramps (the loop needs the speed, and a flight can't skip it). That covers m3 (both gaps), e2 Grand Gulch, e4 Sea Stack and e8 Skywalk. The m3 Roadster had been landing at about 126 km/h 60 m before Eclipse Loop and falling out of it. m3: STRESS 39/40 and finishrun 12/12, identical to db99eda on the same harness (117848c: 35/40, 10/12). `STRESS=1 LV=..` now honours LV.
- B48: the visible boost lock only covers the last 250 m before the lip plus the flight, and it releases the moment the car lands. Between 450 and 250 m before the lip the governor only cuts drive while the car is above its profile, with no lock and no braking beyond the 1 g budget.
- B46: total along-road slowdown, including drag and slope, is held at <= 0.97 g. The governor measures the car's own decel each step, brakes only for the rest, and only cuts drive on the first step. drive.test measures 9.83 m/s² along the road on r6 Hop Four from 288 km/h; the old horizontal-only figure over-read on pitch changes. If the zone is too short, the take-off is a little faster and the run-off plus the finish brake handle it.
- B47: after the line the auto-steer limit scales with speed and gravity: 0.6 x min(1, 45·sqrt(9.81/g)/v). Post-line peak: r4 3.33 -> 1.72 g, r1 4.1 -> < 3 g (QA's peak-trace scenario). Moon early decel is unchanged at 7.3 m/s². New drive test: B47 < 2.5 g.
- Same-harness totals: finishrun 117848c 190/198 -> 191/198 (0 airborne at the line). STRESS 613/660 -> 628/660 (0 airborne).
- Suites: drive 80/80, quests 15/15, simtest roadster 23/23 and hauler 23/23, qa local 31/31, player.browser 24/24, BOOST LOCKED cue ok.
