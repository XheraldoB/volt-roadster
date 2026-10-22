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
B6 | Major | P2 | Ferrox cold-gas "hover" climbs instead of hovering, so holding JUMP overshoots landings by about 150 m | 1) `__game.setVehicle('hauler')`, `__game.loadLevel('e1','trial')`. 2) Full throttle into Baby Canyon (gap s0≈1019, pad s≈1116 r9). 3) Hold ⬆ (JUMP) from just after takeoff. Headless repro: `MODE=hold node qa/hovergap.mjs e1` and `node qa/feel2.mjs` | Holding JUMP holds altitude or gives a slow controlled descent ("hold JUMP to hover / soft-land" per the garage note and README) | sim.js L422-426 applies `g*1.12 + 2.2*max(0,-vy)` upward, which is a net +0.12 g climb whenever vy≥0. Vertical speed rises from +7.5 to +9.9 m/s, the truck peaks 41 m above the road and lands at s≈1268, 152 m past the pad. Touchdown is −24.6 m/s (plain jump: lands s≈1129). Holding from rest 20 m up climbs 2.2 m, empties the 2.5 s tank and touches down at −18.1 m/s, worse than no input (−17.3). Only a timed late burn soft-lands (−3.5 m/s). Same on Moon and Mars | Open
B7 | Major | P2 | Ferrox pickup (price 🪙6000) can be selected for free | Fresh save (300 coins), Garage, Vehicle, tap SELECT on Volt Ferrox | Locked behind 🪙6000 (vehicles.js `price:{coins:6000}`) with a buy/confirm step, or remove the price if free is intended | Vehicle switches to hauler and coins stay 300. The main.js `[data-veh]` handler has no price or ownership check (p2-results.json `hauler_price_check`) | Open
B8 | Major | P1 | GPU texture leak on every level load (VRAM growth on phone) | Loop `await __game.loadLevel(id)` over e3, m3, r3, e6 eight times and read `__game.gfx.renderer.info.memory.textures` | Texture count returns to baseline after a level is disposed | 86→97→112→127→142→153→168→183 (about +14 per load). Geometry count is stable. LevelView.dispose() disposes geometries and materials but never their textures (non-cached CanvasTextures from textures.js, e.g. L75 sign/billboard textures, plus env/terrain maps). Retry and Next on a phone keep stacking VRAM until a context loss | Open
B9 | Major | P2 | Hero car has detached floating parts (roof plate, mirror cubes, headlight strips) | Title screen or Garage, any quality (Ultra shown). See qa-shots/vis-garage-ultra.png, p1-title-2772.png | Parts sit flush on the body | A body-colour roof plate hovers above the glass canopy (models.js L93, box at y=0.435). Two small red cubes (mirrors/intakes) float beside the cabin, white headlight slits float above the hood, and there are dark artefacts on the front wheel arch. Very visible in the 3D hero shots (R2/R12) | Open
B10 | Major | P1 | Rotating to portrait mid-race doesn't pause; the race keeps running under the rotate overlay | Start any race (e2), wait for GO, rotate the phone (viewport to portrait) for 3 s, rotate back | Game pauses while the rotate prompt is up (like visibility hidden) | `#rotate` covers the screen but the sim keeps running: raceTime 2.0→3.9 s and battery 58→56 s in 3 s, with auto-gas still driving blind (p1-results.json `orientation`, p1-portrait-midrace.png) | Open
B11 | Minor | P2 | Brakes are weak: 100→0 km/h takes 64.6 m / 4.7 s (≈0.6 g) on both vehicles | `node qa/feel2.mjs` (e1 straight, respawnAt(25, 27.8), brake=1) | Hypercar stops in roughly 30–35 m; the heavy pickup should differ from the roadster | 64.6 m for both. Braking force is scaled by mass/1650, so the pickup brakes identically to the roadster | Open
B12 | Minor | P2 | Steering is very twitchy at mid speed with digital touch buttons | e1, 80 km/h, hold ▶ (or 0.5 analog) for 0.6 s (`node qa/feel2.mjs`) | Progressive turn-in that a thumb can modulate | 42° of heading in 0.6 s at full input and 36° at half input. The car reaches the wall in under 0.7 s, and a 42° wall hit drops 79→3 km/h with no crash or respawn. Hard to drive precisely with on/off buttons | Open
B13 | Minor | P3 | Restore code with a leading space/newline is truncated, giving "Code not found" | Settings, Cloud save, paste " VOLT-XXXX-XXXX-XXXX" (leading space), Restore | Input trims whitespace before the 19-char limit | `maxlength=19` truncates first, leaving " VOLT-XXXX-XXXX-XXX", so the server returns 404 (seen live: `/api/load?code=VOLT-8XYC-5LBZ-5UT`) | Open
B14 | Minor | P3 | Every fresh launch writes a cloud record before the player does anything; restoring leaves an orphan record | Open the live site in a new profile: boot runs cloudLoad, then cloudSync POST /api/save | Write on the first meaningful progress, or reuse identity on restore | Each new device or visitor creates 2 blobs (code + save). Restoring on a device orphans that device's own record. Each /api/load does a Blob `list()`. Saves are `access:'public'` blobs, unguessable but world-readable by URL. Cost/quota and privacy hygiene | Open
B15 | Minor | P2 | Landing impact isn't penalised: the pickup lands at −24.6 m/s vertical and scores "CLEAN LANDING" | Same as B6 (hover overshoot), or drop from 30 m | Very hard landings damage, bounce or crash the car (R16 realism) | Crash-on-landing only checks orientation (sim.js landed()), so any upright touchdown is clean | Open
B16 | Minor | P2 | Mars dust devil launches the car off the road on curves | `node qa/devil-trace.mjs r1 274` (devil at s=300): 11 m/s vertical impulse plus 5.8 s airtime in Mars gravity | Boost keeps the car on or near the track | The car flies straight while the track curves, lands at x≈26 m (road half-width 7) on terrain, then drives under the Rust Rift ramp and falls (fall crash). Steering in the air only yaws the car, so the player can't correct | Open
B17 | Minor | P2 | HUD text too small and low-contrast on bright skies | Any day level (e1), screenshot p1-race-hud.png / p1-dpr3-race.png | Level name, km/h unit and BOOST/THRUST labels readable at arm's length | Level/mode title and the small labels are about 7–8 CSS px, light grey over the bright sky, and practically unreadable | Open
B18 | Minor | P1 | No pause when the WebGL context is lost; console warnings after restore | In race: `ext=gl.getExtension('WEBGL_lose_context'); ext.loseContext(); setTimeout(()=>ext.restoreContext(),1000)` | Clean recovery with no GL errors, ideally paused while lost | Rendering recovers and the race continues, but there are 11× "WebGL: INVALID_OPERATION: delete/deleteVertexArray: object does not belong to this context" (stale objects disposed after restore). The sim also keeps running while the screen is black | Open
B19 | Minor | P2 | Achievement toast covers the results title | Finish e1 for the first time | Toast placed clear of the results headline | The "🏆 First Finish" toast sits on top of "1ST PLACE!" (p2-results.png) | Open
B20 | Trivial | P1 | FPS counter can never show below 10 | Settings, Show FPS, on a slow GPU | Real fps | dt is clamped to 0.1 s before the fps average, so the counter shows 10 while actual is about 3.5 fps (2772x1272 software GL). The sim also runs at about 0.8× real time below 12 fps (max 10 substeps), intentional but worth knowing | Open
B21 | Trivial | P2 | Base hex pad renders split in two | Base, Earth, top-right pad (vis-base-ultra.png) | Whole hex pad | Pad appears cut into two pieces where the terrain pokes through the middle | Open
B22 | Trivial | P1 | Moon free-fall acceleration measured 1.75 m/s² vs configured 1.62 | Pause, lift the car 60 m, step the sim 0.5 s with no input (p1 `gravity`) | 1.62 | 1.75 (+8%); Mars 3.80 vs 3.71, Earth 9.76 vs 9.81. Small extra downward force while airborne on low-g worlds | Open
