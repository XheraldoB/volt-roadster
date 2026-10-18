# Volt Roadster ⚡

A mobile-first 3D browser driving game: an original electric hypercar (plus the **VOLT Ferrox** stainless pickup with cold-gas RCS jets) racing across **Earth, the Moon and Mars**. Loops, corkscrews, wall rides, canyon and cliff jumps, precision landing pads, traffic hopping, AI races, time trials, side quests, base building with robot helpers, and cloud saves.

Built with **Three.js** (AgX tone mapping, PBR, bloom, GTAO on Ultra, adaptive resolution up to 120 fps) and **Rapier** physics (fixed 120 Hz step plus interpolation).

## Play
- Phone: landscape, touch controls (steer ◀ ▶, gas/brake, 🔥 boost, ⬆ jump/thrust, 📯 horn). Installable as a PWA.
- Keyboard: WASD/arrows, Shift boost, Space jump/thrust/hover, H horn, C camera, R respawn, P pause, M radio, F fullscreen.

## Features
- 23 levels (9 Earth, 7 Moon, 7 Mars). Each level has stars, objectives (race, time trial, precision landing, stunt score, collect) and a funny side quest.
- Battery timer, coins, 8 upgrade lines (tank, speed, accel, handling, boost, thruster, magnet, cold-gas tank) and a workshop discount.
- Two vehicles:
  - Roadster: light and fast, with battery thrusters.
  - Ferrox pickup: heavy, tough and grippy, with cold-gas RCS for hover hops, soft landings and attitude control.
- Customization shop with 9 categories:
  - Paint: metallic, matte, chrome, pearl and more.
  - Wraps, wheels, spoilers and underglow.
  - Boost flame colour, trails and horns.
- Currencies: coins, plus premium 💎 gems that are earned slowly by playing.
- Gem store screen: Stripe-ready but **disabled** (`src/config.js` `PAYMENTS.enabled = false`). No real-money purchase is possible until a payment provider and its webhook are wired.
- Extras:
  - Photo mode, ghost replays, bullet time, rocket cutscene between planets.
  - Meteor showers, dust devils and the Spaceport level.
  - Daily challenges with streaks, achievements and a trophy room.
  - Drone cam, procedural synthwave radio and Easter eggs.
- Saves: local plus cloud through Vercel serverless (one function `api/[fn].js` → `server/*.js`: `/api/save`, `/api/load`, `/api/health`). Storage is Upstash Redis REST (`KV_REST_API_URL`/`KV_REST_API_TOKEN`) or Vercel Blob (`BLOB_READ_WRITE_TOKEN`). Saves are anonymous and come with a recovery code.

## Develop
```bash
npm install
npm run dev        # http://localhost:5173 (serves /api locally too)
npm run build && npm run preview   # http://localhost:4173
npm run simtest    # headless autopilot through every level (VEH=hauler for the pickup)
node tools/qa.mjs  # automated QA in headless Chrome (TESTING.md)
```
`window.__game` exposes a debug hook: fps, car state, world/level, `save()`/`load()`, `loadLevel(id)`, `setVehicle(id)`.

## Folders
`src/` game, `api/[fn].js` + `server/` serverless, `design/` level and economy data, `art/` procedural models/materials/FX, `tools/` test and import scripts.

No third-party logos, trademarks or photos are used. All vehicles and robots are original procedural designs.
