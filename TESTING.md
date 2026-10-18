# Volt Roadster — QA Test Plan & Bug Log
Owner: Game QA Tester. Lead: Game Maker. Source of truth: REQUIREMENTS.md (every item maps to tests below).
Test device profile: OnePlus 15 landscape, viewport 2772x1272, deviceScaleFactor ~1 (also spot-check DPR 3 at 924x424 CSS), hasTouch, isMobile, Chrome at /usr/bin/google-chrome via playwright-core.
Status: Phase 1 + 2 automated run PASS 31/31 (tools/qa.mjs, both vehicles, 924x424 DPR2 touch, software GL). Autopilot `npm run simtest` finishes all 23 levels with the roadster and with the pickup (VEH=hauler).

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

## Bug log
Format: ID | Severity (Blocker/Major/Minor/Trivial) | Phase | Title | Steps | Expected | Actual | Status
B1 | Major | P1 | Physics explosion (2,600 m/s) | autopilot e-levels | stable | kinematic traffic teleported via setNextKinematicTranslation | FIXED (setTranslation + wrap guard + velocity clamp)
B2 | Major | P2 | Overexposed white frame | any level, high | readable image | bloom threshold/env too bright | FIXED (AgX, threshold, env 0.28)
B3 | Minor | P1 | /api 404 under vite preview -> console error | preview | 0 errors | no local API | FIXED (vite local-api middleware, 200 for not-found)
B4 | Major | P2 | Pickup fails big gaps (e4, r3) | VEH=hauler simtest | completes | heavy truck under jump speed | FIXED (ramp launch assist + RCS hover)
B5 | Minor | P2 | Garage notes overlapped | garage vehicle tab | readable | .hint class collided with absolute-positioned hint | FIXED
