# Volt Roadster — design notes (Level Designer)

## Pillars
1. **Real physics, readable skill.** Every jump is solved with real projectile maths for each planet's gravity, and every loop has its √(5gr) entry speed. The HUD can show "need 39 m/s" before a ramp, and AI rivals use the same numbers.
2. **Three planets, three feels.** Earth is fast and dense (traffic, loops, short gaps). The Moon is floaty: 150–380 m holes and up to 11 s of air. Mars sits between them, adding storms that cut grip and visibility, plus volcano climbs and descents.
3. **Generous, never paywalled.** No premium currency, no energy system, no paid skips, and crashing never costs coins. Every level can be finished with a stock car.
4. **Funny.** Each level has a silly side quest with a named character. Robots have moods. Rivals taunt you.

## Content
- 22 levels: Earth 8, Moon 7, Mars 7. The 10 existing engine levels keep their segments verbatim; the 12 new ones are e5–e8, m4–m7, r4–r7.
- Objective mix per planet: time trial, race, precision landing, collect, stunt score. All planets are open; within a planet, levels unlock in `order` (matches `progress.isUnlocked`).
- Signature loop: e1 keeps the engine's "Signature Loop" (r 22), and e6 opens with the "Roadster Loop" (r 22). There are 39 loops in total, from 22 m up to the 32 m Gigaloop.

## Difficulty curve (diff 1→5 per planet)
| Planet | order → id (diff) |
|---|---|
| Earth | e1(1) e2(2) e3(3) e5(3) e4(4) e6(4) e7(4) e8(5) |
| Moon | m1(2) m4(3) m2(3) m5(4) m3(4) m6(4) m7(5) |
| Mars | r1(2) r4(3) r2(3) r5(4) r6(4) r3(5) r7(5) |

What ramps up with difficulty: gap width (Earth 60→125 m, Moon 150→380 m, Mars 120→350 m), landing pad radius (9→5 m), number of loops and corkscrews, traffic density (5→10 cars), storm intensity, and the optional battery `drainMul` (1.0→1.3).

## Physics (verified numerically in `gen/validate.mjs`)
- **Gap:** v_min = √( g·x² / (2cos²a·(x·tan a + drop)) ). This is the same equation `track.js` solves for `gap.len`, so `speed` in each segment *is* the minimum clearing speed. Each jump also lists `padSpeed` (speed to land on the pad centre) and `overshootSpeed` (speed that flies past the end of the landing zone). Example, Earth Broken Span: x 100 m, 18°, drop 3 → 39.1 m/s to clear, 41.1 to hit the pad, 51.2 overshoots, 3.5 s of air.
- **Same 18° ramp on each planet**, speed needed to clear 100 m: Earth 39.1, Mars 24.1, Moon 15.9 m/s. That is why Moon gaps are 2–4x longer.
- **Loops:** entry ≥ √(5gr), top ≥ √(gr). For r 24: Earth 34.3 / 15.3, Mars 21.1 / 9.4, Moon 13.9 / 6.2 m/s. Note that `sim.js` magnet assist holds the car above 9 m/s anyway, so these numbers drive the speed hint, the AI and a possible "clean loop" bonus rather than pass/fail.
- **Car limits:** stock vmax is 52 m/s (66 with boost). The hardest stock jumps need 44 m/s (Grand Gulch, Summit Launch), so they can be cleared at tier 0.

## Battery
Supply = tank 60 s + 3 s per checkpoint + 12 s per battery pickup (every 340 m), compared against estimated drain at a bronze pace. At the current constants every level has 1.45–1.83x the battery it needs, so the timer never really threatens. Each level therefore carries an optional `drainMul` that targets about 1.8x headroom at diff 1 and 1.25x at diff 5. Tank upgrades (+12 s per tier), charger robots (+1 s per checkpoint) and the Solar building then feel meaningful.

## Economy reasoning (rescaled Oct 18 per Game Maker: core ≈ 120k / ~12 h, thruster 0.3 s per tier)
- Run income is unchanged and matches `progress.applyResult`: collected coins (≈260 available per level), score/120, 150 per new star, quest reward (25% on repeats), dailies, and miners.
- Sinks:
  - 6 core tracks: **119,990** (tank 20,810, speed 23,930, accel 20,810, handling 18,730, boost 18,730, thruster 16,980).
  - Magnet perk: 9,250.
  - Buildings: 85,260.
  - All 21 robots: 28,360.
  - **Grand total: 242,860.**
- The geometric cost curve is unchanged: tier 1 ≈ 160–240, tier 10 ≈ 5.2–6.6k. `CORE_TARGET` in `gen/build_meta.mjs` sets the scale (`UPG_SCALE` is derived from it). Magnet uses the same scale, and buildings and robots use `BASE_SCALE` (same 0.4x ratio as the core rescale).
- The pacing simulation (20-minute sessions of 6 runs, 2 a day) runs two player profiles:
  - **Balanced** (buys base and robots too; car items ranked first): core maxed at **14.3 h**, everything at **17 h**.
  - **Core-first** (car only until maxed): core maxed at **8.7 h**, everything at 18 h.
  - Game Maker's ~12 h target sits between the two. A core of ~105k would put the balanced player at 12.3 h.
  - Both profiles buy something in **20 of the first 20 sessions** (balanced: 19 buys in session 1, then 10, 8, 7, 5, ...).

## Integration notes for Game Maker
| Spec | Plugs into | Notes |
|---|---|---|
| `levels.*.json` `segments`, `id/planet/env/diff/quest/storm/startY` | `src/levels.js` `LEVELS` → `track.js buildTrack(def, g)`, `terrain.js makeTerrain`, `sim.js Sim` | Drop-in, smoke-tested with `Sim.init()` for all 22. Keep `levelById`/`levelsOf`; sort by `order`. Gap segments omit `len` (buildTrack computes it and **mutates** `sg.len`, so clone defs if reused). New gaps set `land` (90–240 m) so faster upgraded cars do not overshoot. |
| `objective`, `stars` | `Sim.finish()` (currently: race = position, trial = len/38 and len/32) | time_trial and race use the **same formulas** as `finish()`. precision_landing (count `pad`/`perfect` events), collect (quest progress) and stunt_score (score vs goal = len·4 + diff·2500) need an objective switch in `finish()`. |
| `loops[]`, `jumps[]` | HUD speed hint, `updateAI` (already uses gap `speed*1.06`) | Informational. `aiTargetSpeed` is precomputed. |
| `landingZones[].rings` | `Sim.landed()` pad scoring | Current continuous formula (2500 perfect, 1500·(1−d/padR)+300) is compatible; rings are an optional tiered version. |
| `battery.drainMul`, `pickupsAt` | `Sim.rules()` battery drain; `buildEntities()` battery placement | `pickupsAt` replicates the current every-340 m rule; `drainMul` is new (default 1). |
| `checkpoints.spacing` | `track.js` hardcoded 220 | Moon 300 and Mars 260 are suggested; this needs a `def.cpSpacing` param. |
| `storm`, `stormFx` | `level.storm` already exists but is **unused in sim**; render `env.js` `marsstorm` | Apply `gripMul` to `setWheelFrictionSlip`, `fogDensity`/`visibilityM` to the scene fog, and minimap noise. |
| `terrain.volcano` (r7), traffic `skin` (rover/crawler), quest `skin` (robot/dustbot/moonbuggy/marsrover), `noCrash` | `terrain.js` (volcano only for `id==='r3'`), `models.js buildTraffic/buildRobot`, `Sim.questRules` | Small additions. The levels still load without them. |
| `hazards[]` (`implemented:false`) | new | traffic is live; crosswind, rockfall, dustDevil, meteorShower, regolithSlip, boulders, darkness and lavaVent are new (several are cosmetic-only). |
| `races.json` | `Sim.buildEntities()` AI block (fixed 3 AI, `skill = 0.82 + diff*0.035`), `updateAI` rubber band | Needs `opts.aiCount`, `opts.skill`, `opts.rubber` plus series, duel and elimination flow in the UI. The "normal" tier equals the current bands. |
| `economy.json` | `progress.js` `UPGRADES`, `MAX_UP`, `upgradeCost()`, `applyResult()`; `sim.js carStats()` | Stat values follow `carStats` linear formulas. Decided: 10 tiers per core track (thruster 8) → MAX_UP must become per-track (10, thruster 8); `upgradeCost()` → table lookup `upgradeTracks[k].tiers[lvl].cost`; **thruster `thrustCap = 1.0 + 0.3·l`** (change `carStats` from 0.5). Magnet needs `stats.magnet` replacing the 3.4 m pickup radius in `rules()`. |
| `base_building.json` | `progress.js` `BUILDINGS`, plots, `runBonus()`, `refineryRate()`, `robotCount()`; `Sim` `opts.robots`, `opts.bonus` | See `compatWithProgressJs.mapping`. Costs rescaled with the economy (buildings 85k, robots 28k). Chargers → `opts.robots`; Solar → `bonus.tank`; Workshop → discount. |
| `side_quests.json` | `level.quest` + `Sim.questRules()` | 22 run on existing types. New types: `fragile` (land strength cap via the `land` event), `speedtrap`, `statGoal` (reads `sim.stat`). |
| `daily_challenges.json` | `progress.js` `DAILY_T`, `dailyChallenges()`, `dailyCheck()` | Superset. Day-scope goals need `save.daily.counters`; suggested streak cap is +50%. |
