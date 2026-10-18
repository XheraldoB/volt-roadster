# Volt Roadster — design specs (Level Designer)

Everything here is data or docs. Nothing in `src/` or `tools/` was changed. Regenerate with:

```bash
node design/gen/build_levels.mjs   # levels.*.json (uses the engine's own buildTrack for lengths/gaps/checkpoints)
node design/gen/build_meta.mjs     # races, side_quests, daily_challenges, economy, base_building
node design/gen/validate.mjs       # parses every JSON + checks the projectile and loop maths numerically
node design/gen/smoke_sim.mjs      # loads all 22 levels into src/sim.js Sim headless (no code changes needed)
```

| File | What it is | How to load |
|---|---|---|
| `levels.earth.json` / `levels.moon.json` / `levels.mars.json` | 8 + 7 + 7 levels. `segments[]` is the exact `src/levels.js` format; also objective, stars, battery, coins, loops, jumps (with the maths), landing zones, hazards, checkpoints | `import E from '../design/levels.earth.json'` (Vite JSON import); `LEVELS = [...E.levels, ...M.levels, ...R.levels].map(toEngineLevel)` where `toEngineLevel = l => ({ id, planet, name, env, diff, blurb, quest, storm, startY, segments })`; sort each planet by `order` (isUnlocked relies on array order) |
| `races.json` | 14 race events (series, duel, elimination, single), rival roster = `sim.js` AI_NAMES, rubber-band tiers and limits, rewards | Race menu; pass `aiRivals`/`skill`/`rubberBand` into `new Sim(level, { mode: 'race', ... })` |
| `side_quests.json` | 28 side quests (10 already in the engine, 12 on new levels using existing quest types, 6 needing small new types) with triggers, rewards and dialogue | `level.quest` stays the in-run quest; this file adds the giver UI, dialogue and the `afterStars`/`baseVisit` quests |
| `daily_challenges.json` | Pool of 25 dailies plus seeding rules, rewards and streaks | Superset of `progress.js` DAILY_T; swap the pool, keep `dailyChallenges()`/`dailyCheck()` |
| `economy.json` | 6 upgrade tracks (`tank, speed, accel, handling, boost, thruster`, 10/10/10/10/10/8 tiers; maxing the core ≈ 120k coins, about 12 h) plus the optional `magnet` perk (9k); thruster = +0.3 s per tier; costs, stat values per tier, income sources, two-profile pacing simulation | `UPGRADES` / `upgradeCost()` in `progress.js` → look up `upgradeTracks[k].tiers[lvl].cost`; stats stay `carStats(up, bonus)` |
| `base_building.json` | VOLT-Bot robots (miner, mechanic, charger, scout; 21 robots, 28k), 10 planet buildings (85k) mapped onto `progress.js` BUILDINGS, build timers, passive income, effects on the car | `BUILDINGS` in `progress.js` + `compatWithProgressJs.mapping` |
| `DESIGN_NOTES.md` | Design pillars, difficulty curve, economy reasoning, **integration notes for Game Maker** | read |
| `IDEAS.md` | 20 extra ideas (requirement 11) | send to the user |
| `gen/levels_summary.json` | One line per level: length, gold time, jump speeds, loops | quick reference |

Units match the engine: metres, m/s, degrees, seconds, m/s². Gravity: Earth 9.81, Moon 1.62, Mars 3.71. All three planets are unlocked from the start (requirement 21).
