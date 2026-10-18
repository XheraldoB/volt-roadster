// Generates races.json, side_quests.json, daily_challenges.json, economy.json, base_building.json
// Run after build_levels.mjs:  node design/gen/build_meta.mjs
import { readFileSync, writeFileSync } from 'fs';
const OUT = new URL('../', import.meta.url).pathname;
const lv = p => JSON.parse(readFileSync(OUT + `levels.${p}.json`, 'utf8')).levels;
const LV = { earth: lv('earth'), moon: lv('moon'), mars: lv('mars') };
const ALL = [...LV.earth, ...LV.moon, ...LV.mars];
const byId = id => ALL.find(l => l.id === id);
const W = (f, o) => writeFileSync(OUT + f, JSON.stringify(o, null, 2));
const AI_NAMES = ['Nova', 'Sparky', 'Ion Ivy', 'Turbo Tess', 'Ampere', 'Watt Rodriguez', 'Coil', 'Dyna']; // = sim.js AI_NAMES

// ======================= RACES =======================
const rubber = (tier) => ({
  // same bands as sim.updateAI; gap = ai.s - player.s (m). mult applied to AI target speed.
  tier,
  bands: tier === 'easy'
    ? [{ gapOver: 160, mult: 0.70 }, { gapOver: 50, mult: 0.82 }, { gapOver: 0, mult: 0.92 }, { gapUnder: -120, mult: 1.12 }, { gapUnder: -40, mult: 1.05 }]
    : tier === 'normal'
      ? [{ gapOver: 160, mult: 0.72 }, { gapOver: 50, mult: 0.85 }, { gapOver: 0, mult: 0.93 }, { gapUnder: -120, mult: 1.18 }, { gapUnder: -40, mult: 1.08 }]
      : [{ gapOver: 160, mult: 0.80 }, { gapOver: 50, mult: 0.90 }, { gapOver: 0, mult: 0.97 }, { gapUnder: -120, mult: 1.22 }, { gapUnder: -40, mult: 1.10 }],
  limits: { minMult: tier === 'hard' ? 0.8 : 0.7, maxMult: tier === 'hard' ? 1.22 : 1.18, neverExceed: 'aiVmax = player stats.vmax * 1.05 (no impossible catch-ups)', disableInLast: tier === 'hard' ? 0 : 250, note: 'disableInLast: metres before finish where AI stops slowing down for the player, so wins feel earned' },
});
const ev = (id, planet, name, levels, format, aiCount, skillBase, tier, reward, extra = {}) => ({
  id, planet, name, levels, format, aiRivals: aiCount, skill: { base: skillBase, perDiff: 0.035, spread: 0.025, simFormula: 'skill = 0.82 + diff*0.035; rival k gets skill*(0.97+0.025k)' },
  rubberBand: rubber(tier), rewards: reward, unlocked: true, ...extra });
const rw = (p1, p2, p3, first, cosmetic) => ({ coinsByPosition: [p1, p2, p3, Math.round(p3 * 0.4)], firstWinBonus: first, repeatMultiplier: 0.5, cosmeticOnFirstWin: cosmetic });
const races = {
  schema: 'volt-roadster/races@1',
  notes: 'sim.js currently spawns exactly 3 AI (mode "race") with one rubber-band table. aiRivals>3 and per-event rubberBand tiers need small sim changes (see DESIGN_NOTES). Rival names = sim.js AI_NAMES.',
  rivals: AI_NAMES.map((n, i) => ({ name: n, colorIndex: i, style: ['clean racer', 'chaotic jumper', 'drift queen', 'boost hog', 'calculated', 'show-off', 'silent pro', 'veteran'][i],
    taunts: [
      ['See you at the finish. Well, I will.', 'Your battery is showing.'], ['WHEEE! Oh hi, you are still here?', 'I jumped a bus once. On purpose. Mostly.'],
      ['Corners are just straights with style.', 'Try to keep up, sparky. Oh wait, that is Sparky.'], ['Boost is a lifestyle.', 'My boost meter has a boost meter.'],
      ['Your racing line is 3.7% suboptimal.', 'Calculating your defeat... done.'], ['Did everyone see that? Somebody film that!', 'Autographs after the race.'],
      ['...', '... (revs engine politely)'], ['I was looping loops before loops were cool.', 'Back in my day the Moon had no ramps.']][i] })),
  events: [
    ev('earth_sprint_cup', 'earth', 'Sunrise Sprint Cup', ['e1', 'e2'], { type: 'series', pointsPerPosition: [10, 6, 3, 1] }, 3, 0.82, 'easy', rw(600, 350, 200, 500, 'decal_sunrise')),
    ev('earth_rush_hour', 'earth', 'Rush Hour Duel', ['e5'], { type: 'duel', rival: 'Sparky', rule: 'bonus +200 coins per car jumped' }, 1, 0.9, 'normal', rw(900, 0, 0, 600, 'horn_traffic')),
    ev('earth_coast_gp', 'earth', 'Coastline Grand Prix', ['e4', 'e7'], { type: 'series', pointsPerPosition: [10, 6, 3, 1] }, 3, 0.92, 'normal', rw(1200, 700, 400, 900, 'paint_sunset_pearl')),
    ev('earth_canyon_gp', 'earth', 'Grand Canyon GP', ['e8'], { type: 'single' }, 3, 0.96, 'hard', rw(1600, 900, 500, 1500, 'wheels_canyon')),
    ev('earth_elimination', 'earth', 'Loop City Elimination', ['e3', 'e6'], { type: 'elimination', rule: 'last place at each checkpoint after the 3rd is eliminated' }, 5, 0.9, 'normal', rw(1300, 700, 400, 1000, 'trail_neon')),
    ev('moon_sprint', 'moon', 'Tranquility Sprint', ['m1'], { type: 'single' }, 3, 0.84, 'easy', rw(700, 400, 250, 500, 'decal_crescent')),
    ev('moon_lowg_relay', 'moon', 'Low-G Relay', ['m4', 'm2'], { type: 'series', pointsPerPosition: [10, 6, 3, 1], rule: 'airtime over 6 s grants +1 point' }, 3, 0.88, 'normal', rw(1100, 600, 350, 800, 'trail_stardust')),
    ev('moon_rille_gp', 'moon', 'Hadley Rille GP', ['m6'], { type: 'single' }, 3, 0.93, 'normal', rw(1300, 750, 400, 1000, 'paint_regolith_grey')),
    ev('moon_dark_side', 'moon', 'Dark Side Championship', ['m3', 'm5', 'm7'], { type: 'series', pointsPerPosition: [10, 6, 3, 1] }, 4, 0.97, 'hard', rw(2200, 1200, 700, 2000, 'body_kit_lunar')),
    ev('mars_dust_rally', 'mars', 'Red Dust Rally', ['r1', 'r4'], { type: 'series', pointsPerPosition: [10, 6, 3, 1] }, 3, 0.85, 'easy', rw(800, 450, 250, 600, 'decal_redplanet')),
    ev('mars_storm_chaser', 'mars', 'Storm Chaser', ['r5'], { type: 'single', rule: 'storm intensity ramps 0.4 -> 1.0 during the race; AI also loses grip (stormFx.gripMul)' }, 3, 0.92, 'normal', rw(1400, 800, 450, 1100, 'lights_storm_amber')),
    ev('mars_valles_gp', 'mars', 'Valles Marineris GP', ['r2', 'r6'], { type: 'series', pointsPerPosition: [10, 6, 3, 1] }, 3, 0.93, 'normal', rw(1500, 850, 450, 1100, 'paint_rust_metallic')),
    ev('mars_olympus', 'mars', 'Olympus Championship', ['r3', 'r7'], { type: 'series', pointsPerPosition: [10, 6, 3, 1] }, 4, 0.98, 'hard', rw(2400, 1300, 750, 2200, 'body_kit_olympus')),
    ev('tri_planet_final', 'any', 'Tri-Planet Final', ['e8', 'm7', 'r3'], { type: 'series', pointsPerPosition: [12, 7, 4, 1], rule: 'unlocks after winning any 6 events (soft goal, not a gate on planets)' }, 4, 1.0, 'hard', rw(4000, 2000, 1000, 5000, 'paint_tri_planet_chrome')),
  ],
};
W('races.json', races);

// ======================= SIDE QUESTS =======================
const sq = (id, planet, level, name, simType, status, trigger, objective, reward, dlg, extra = {}) => ({ id, planet, level, name, simType, status, trigger, objective, reward, dialogue: dlg, ...extra });
const lq = id => byId(id).quest;
const quests = [
  sq('sq_mailbox', 'earth', 'e1', 'Mailbox Mayhem', 'mailbox', 'engine', { kind: 'levelStart' }, lq('e1'), { coins: 250, xp: 50 }, { giver: 'Mayor Pemberton', intro: 'Those mailboxes have been sending me spam for years. Do what you must.', success: 'Finally, peace and quiet. And no more catalogues.', fail: 'The mailboxes win this round.' }),
  sq('sq_pizza_express', 'earth', 'e2', 'Pizza Express', 'pizza', 'engine', { kind: 'proximity', item: 'pizza' }, lq('e2'), { coins: 350, xp: 70 }, { giver: 'Luigi Volta', intro: 'Thirty-two seconds or it is free. And I do not do free.', success: 'Hot, crispy, slightly airborne. Perfetto!', fail: 'Cold pizza. A tragedy in one act.' }),
  sq('sq_donut', 'earth', 'e3', 'Donut Dunk', 'ring', 'engine', { kind: 'levelStart' }, lq('e3'), { coins: 400, xp: 80 }, { giver: 'Officer Glaze', intro: 'Fly through the donut. I would, but I would eat it.', success: 'Sprinkles everywhere. Magnificent.', fail: 'You missed the donut. The donut is disappointed.' }),
  sq('sq_runaway_cow', 'earth', 'e4', 'Runaway Cow', 'cow', 'engine', { kind: 'levelStart' }, lq('e4'), { coins: 450, xp: 90 }, { giver: 'Farmer Joan', intro: 'Bessie saw the ocean and just... went. Bring her home!', success: 'Moo! (Bessie says thank you and also moo.)', fail: 'Bessie is now a beach cow. Forever.' }),
  sq('sq_lost_luggage', 'earth', 'e5', 'Lost Luggage', 'collect', 'new-level', { kind: 'levelStart' }, lq('e5'), { coins: 400, xp: 80 }, { giver: 'Gary (Tourist)', intro: 'I strapped six suitcases to my roof. In hindsight, with string.', success: 'All six! Even the one full of socks!', fail: 'Somewhere out there, my socks are free.' }),
  sq('sq_hoop_dreams', 'earth', 'e6', 'Hoop Dreams', 'ring', 'new-level', { kind: 'levelStart' }, lq('e6'), { coins: 450, xp: 90 }, { giver: 'Ringmaster Flo', intro: 'The flaming hoop! Safety rating: technically legal.', success: 'Through the fire! The crowd goes mild! I mean wild!', fail: 'You went around the hoop. That is called driving.' }),
  sq('sq_lighthouse_pizza', 'earth', 'e7', 'Lighthouse Pizza', 'pizza', 'new-level', { kind: 'proximity', item: 'pizza' }, lq('e7'), { coins: 450, xp: 90 }, { giver: 'Keeper Morgan', intro: 'Large pepperoni. The bridge is out, but I believe in you.', success: 'It flew over the sea and it is still hot? Marry me. No. Tip accepted.', fail: 'The seagulls got it. They always get it.' }),
  sq('sq_runaway_robot', 'earth', 'e8', 'Runaway Robot', 'cow', 'new-level', { kind: 'levelStart' }, lq('e8'), { coins: 550, xp: 110 }, { giver: 'B0LT (fleeing)', intro: 'B0LT: I AM NOT RUNNING. I AM RELOCATING. WITH YOUR CABLE.', success: 'B0LT: FINE. HERE IS YOUR CABLE. I WAS GOING TO RETURN IT. EVENTUALLY.', fail: 'B0LT: SEE YOU NEVER, HUMAN. (beep)' }, { skin: 'robot', needsCode: 'cow logic reused; render B0LT model when quest.skin==="robot", emit "beep" instead of "moo"' }),
  sq('sq_cheese', 'moon', 'm1', 'Cheese Survey', 'collect', 'engine', { kind: 'levelStart' }, lq('m1'), { coins: 350, xp: 70 }, { giver: 'Dr. Brie', intro: 'Science has never proven the Moon is not cheese. Collect samples.', success: 'Results: 100% cheese. Peer review pending.', fail: 'Inconclusive. Also hungry.' }),
  sq('sq_polar_ice', 'moon', 'm4', 'Polar Ice Run', 'deliver', 'new-level', { kind: 'proximity', item: 'ice' }, lq('m4'), { coins: 450, xp: 90 }, { giver: 'Base Chief Okafor', intro: 'Crater ice for the coffee machine. This is a mission-critical latte.', success: 'Latte secured. You are a hero of the outpost.', fail: 'It sublimated. Into space. Like my hopes.' }),
  sq('sq_alien', 'moon', 'm2', 'Alien Hitchhiker', 'deliver', 'engine', { kind: 'proximity', item: 'alien' }, lq('m2'), { coins: 450, xp: 90 }, { giver: 'Zorp', intro: 'Zorp: Greetings. My saucer is parked over there. Also I ate your snacks.', success: 'Zorp: Five stars. Would be abducted by you again.', fail: 'Zorp: I will simply teleport. Bye, slow earthling.' }),
  sq('sq_core_sampler', 'moon', 'm5', 'Core Sampler', 'collect', 'new-level', { kind: 'levelStart' }, lq('m5'), { coins: 500, xp: 100 }, { giver: 'Geologist Pat', intro: 'They glow. They hum. Please do not lick them.', success: 'Six cores! Only one is humming ominously.', fail: 'The cores are now part of the abyss. Science weeps.' }),
  sq('sq_space_donut', 'moon', 'm3', 'Space Donut', 'ring', 'engine', { kind: 'levelStart' }, lq('m3'), { coins: 500, xp: 100 }, { giver: 'Officer Glaze (in orbit)', intro: 'They sent me to space. For donuts. I regret nothing.', success: 'A donut in zero g. Truly the final frontier.', fail: 'The donut drifts on without you.' }),
  sq('sq_buggy_selfie', 'moon', 'm6', 'Buggy Selfie', 'rover', 'new-level', { kind: 'proximity', item: 'moonbuggy' }, lq('m6'), { coins: 450, xp: 90 }, { giver: 'Influencer Kai', intro: 'Vintage moon buggy, Earthrise, you. Hold still for two seconds. Content!', success: '#MoonLife #NoFilter #NoAtmosphere', fail: 'Blurry. Unfollowing.' }, { skin: 'moonbuggy' }),
  sq('sq_earthrise_hoop', 'moon', 'm7', 'Earthrise Hoop', 'ring', 'new-level', { kind: 'levelStart' }, lq('m7'), { coins: 550, xp: 110 }, { giver: 'Ringmaster Flo (spacesuit)', intro: 'Biggest hoop, biggest jump, biggest view. Do not look down. Or do, it is pretty.', success: 'Eleven seconds of air and a hoop! Legend!', fail: 'You missed a hoop the size of a stadium. Impressive, in a way.' }),
  sq('sq_potatoes', 'mars', 'r1', 'Martian Farmer', 'collect', 'engine', { kind: 'levelStart' }, lq('r1'), { coins: 350, xp: 70 }, { giver: 'Botanist Mark', intro: 'I am going to have to science the potatoes out of this. Help me find them.', success: 'Six potatoes! That is a whole sol of dinner.', fail: 'Ketchup without potatoes. The saddest condiment.' }),
  sq('sq_antenna', 'mars', 'r4', 'Antenna Bits', 'collect', 'new-level', { kind: 'levelStart' }, lq('r4'), { coins: 400, xp: 80 }, { giver: 'Lander Unit L-7', intro: 'L-7: Antenna detached. Cannot stream my favourite show. Please assist.', success: 'L-7: Signal restored. Episode 4,812 resumes.', fail: 'L-7: Static. Only static.' }),
  sq('sq_rover_reunion', 'mars', 'r2', 'Rover Reunion', 'rover', 'engine', { kind: 'proximity', item: 'rover' }, lq('r2'), { coins: 400, xp: 80 }, { giver: 'Old Rover', intro: 'beep... boop... (it has been alone for a long time)', success: 'BEEP BEEP! (happiest rover on Mars)', fail: 'boop. (sad)' }),
  sq('sq_dustbot', 'mars', 'r5', 'Runaway Dust-Bot', 'cow', 'new-level', { kind: 'levelStart' }, lq('r5'), { coins: 500, xp: 100 }, { giver: 'Dust-Bot 3000', intro: 'Dust-Bot: SO. MUCH. DUST. I MUST CLEAN IT ALL. FAREWELL.', success: 'Dust-Bot: Thank you. I will start with one crater at a time.', fail: 'Dust-Bot has vacuumed itself into a dune.' }, { skin: 'dustbot', needsCode: 'cow logic, dustbot skin' }),
  sq('sq_canyon_pizza', 'mars', 'r6', 'Canyon Pizza', 'pizza', 'new-level', { kind: 'proximity', item: 'pizza' }, lq('r6'), { coins: 500, xp: 100 }, { giver: 'Luigi Volta (Mars franchise)', intro: 'Across the canyon. No spilling. The toppings are very nervous.', success: 'Not one olive out of place. You are an artist.', fail: 'Pizza face-down in the regolith. Mars-gherita.' }, { needsCode: 'quest.noCrash: fail pizza/deliver on crash() or land strength > 0.85' }),
  sq('sq_ice_core', 'mars', 'r3', 'Ice Core Express', 'deliver', 'engine', { kind: 'proximity', item: 'ice' }, lq('r3'), { coins: 550, xp: 110 }, { giver: 'Dr. Frost', intro: 'This ice core is 3 billion years old and melting in 50 seconds. No pressure.', success: 'Still frozen! History preserved!', fail: '3 billion years, ruined in your cup holder.' }),
  sq('sq_rover_lift', 'mars', 'r7', 'Rover Ride-Along', 'rover', 'new-level', { kind: 'proximity', item: 'marsrover' }, lq('r7'), { coins: 550, xp: 110 }, { giver: 'Lost Rover "Pebble"', intro: 'Pebble: My wheels are tired. Can I ride on your roof? I promise not to drill anything.', success: 'Pebble: Wheee! Best. Field trip. Ever.', fail: 'Pebble: I will just roll home. Slowly. Over 14 years.' }, { skin: 'marsrover' }),
  // ---- free-roam / cross-level quests (need small new quest types) ----
  sq('sq_grandma_eggs', 'earth', 'e2', "Grandma's Eggs", 'fragile', 'needs-code', { kind: 'afterStars', stars: 3 }, { type: 'fragile', item: 'eggs', text: 'Deliver a dozen eggs over the canyons. Land softly (no hard landings).', maxLandStrength: 0.6, reward: 500 }, { coins: 500, xp: 100 }, { giver: 'Grandma Ada', intro: 'Twelve eggs, three canyons, zero excuses, sweetie.', success: 'Not a single crack! Have a cookie. Have six.', fail: 'Well, now we are having omelettes.' }),
  sq('sq_speed_camera', 'earth', 'e6', 'Say Cheese, Speed Camera', 'speedtrap', 'needs-code', { kind: 'levelStart', minTier: { speed: 3 } }, { type: 'speedtrap', text: 'Pass the speed camera at 80 m/s (288 km/h) for the perfect blurry photo', speed: 80, reward: 450 }, { coins: 450, xp: 90, cosmetic: 'photo_speed_blur' }, { giver: 'Speed Camera SC-9', intro: 'SC-9: I have photographed 4 million cars. None were interesting.', success: 'SC-9: Finally. Art.', fail: 'SC-9: Just another sedan. Yawn.' }),
  sq('sq_moon_golf', 'moon', 'm1', 'Moon Golf', 'statGoal', 'needs-code', { kind: 'afterStars', stars: 2 }, { type: 'statGoal', stat: 'maxAir', value: 8, text: 'Hit a 1971-style moon golf shot: stay airborne 8 seconds to "drive" the ball', reward: 400 }, { coins: 400, xp: 80, cosmetic: 'decal_golf_ball' }, { giver: 'Caddie Bot', intro: 'Fore! In one-sixth gravity, the ball goes miles and miles.', success: 'Hole in one! It landed in a crater. Same thing.', fail: 'Mulligan. Nobody saw. Except everyone.' }),
  sq('sq_martian_dj', 'mars', 'r4', 'Martian DJ', 'statGoal', 'needs-code', { kind: 'baseVisit', building: 'mars_greenhouse' }, { type: 'statGoal', stat: 'flips+rolls', value: 4, withinSeconds: 40, text: 'DJ Phobos needs 4 flips or rolls in 40 s to drop the beat', reward: 450 }, { coins: 450, xp: 90, cosmetic: 'horn_bassdrop' }, { giver: 'DJ Phobos', intro: 'Every flip is a beat. Every roll is a bass drop. Make it rain dust!', success: 'The whole colony is dancing! Even the potatoes!', fail: 'Tough crowd. Martians do not clap, they just stare.' }),
  sq('sq_robot_sulk', 'any', 'any', 'Robot Feelings', 'statGoal', 'needs-code', { kind: 'baseVisit', building: 'robot_workshop' }, { type: 'statGoal', stat: 'loops', value: 5, text: 'Your charger robot Juice is sulking. Do 5 loops in one run to cheer it up', reward: 350 }, { coins: 350, xp: 70, robotMood: '+1 (charger works 10% faster for 24 h)' }, { giver: 'Juice (charger robot)', intro: 'Juice: Nobody notices me. I just charge. And charge. Sigh.', success: 'Juice: Five loops? For ME? I am charging with joy!', fail: 'Juice: It is fine. I am fine. (it is not fine)' }),
  sq('sq_parcel_traffic', 'earth', 'e5', 'Express Parcel', 'statGoal', 'needs-code', { kind: 'afterStars', stars: 1 }, { type: 'statGoal', stat: 'carJumps', value: 5, text: 'Jump 5 cars while carrying an "URGENT" parcel', reward: 450 }, { coins: 450, xp: 90 }, { giver: 'Courier Dee', intro: 'Traffic is the enemy. The sky is free. You get the idea.', success: 'Delivered by air! Signature not required.', fail: 'Stuck in traffic like a normal person. Ew.' }),
];
W('side_quests.json', {
  schema: 'volt-roadster/side_quests@1',
  notes: 'status: engine = already in src/levels.js; new-level = attached to a new level using an existing sim.questRules type (no code); needs-code = new type (fragile, speedtrap, statGoal) or skin field. statGoal reads sim.stat keys (flips, rolls, loops, carJumps, nearMiss, perfect, maxAir, gaps, drift, maxSpeed). Rewards are coins (= quest.reward) plus xp for a player-level bar.',
  triggers: { levelStart: 'quest is active when the level loads (current sim behaviour)', proximity: 'starts when the player reaches the pickup (sim pizza/deliver/rover)', afterStars: 'offered on the level card once that level has >= N stars', baseVisit: 'offered by a character at a base building' },
  repeatReward: 0.25, count: quests.length, quests });

// ======================= DAILY CHALLENGES =======================
const dc = (id, tier, name, text, goal, planet = 'any', extra = {}) => ({ id, tier, name, text, goal, planet, ...extra });
const dailies = [
  dc('d_coins_300', 'easy', 'Pocket Change', 'Collect 300 coins today', { stat: 'coins', value: 300, scope: 'day' }),
  dc('d_loops_6', 'easy', 'Loop the Loop', 'Complete 6 loops', { stat: 'loops', value: 6, scope: 'day' }),
  dc('d_carjump_3', 'easy', 'Leapfrog', 'Jump over 3 traffic cars', { stat: 'carJumps', value: 3, scope: 'day' }, 'earth'),
  dc('d_gaps_5', 'easy', 'Mind the Gap', 'Clear 5 canyons or holes', { stat: 'gaps', value: 5, scope: 'day' }),
  dc('d_finish_3', 'easy', 'Daily Drive', 'Finish 3 levels', { stat: 'finishes', value: 3, scope: 'day' }),
  dc('d_nearmiss_5', 'easy', 'Close Shave', 'Get 5 near misses', { stat: 'nearMiss', value: 5, scope: 'day' }, 'earth'),
  dc('d_drift_10', 'easy', 'Sideways Sunday', 'Drift for 10 seconds total', { stat: 'drift', value: 10, scope: 'day' }),
  dc('d_flip_3', 'medium', 'Flip Out', 'Land 3 flips', { stat: 'flips', value: 3, scope: 'day' }),
  dc('d_roll_3', 'medium', 'Barrel of Fun', 'Land 3 barrel rolls', { stat: 'rolls', value: 3, scope: 'day' }),
  dc('d_air_8', 'medium', 'Hang Time', 'Stay airborne 8 s in one jump', { stat: 'maxAir', value: 8, scope: 'run' }, 'moon'),
  dc('d_pad_3', 'medium', 'Sticky Wheels', 'Land on 3 target pads', { stat: 'pads', value: 3, scope: 'day' }),
  dc('d_nocrash', 'medium', 'Clean Sheet', 'Finish the featured level with zero crashes', { stat: 'crashes', value: 0, cmp: '==', scope: 'run', level: 'featured' }),
  dc('d_race_top2', 'medium', 'Podium Finish', 'Finish top 2 in any race', { stat: 'position', value: 2, cmp: '<=', scope: 'run', mode: 'race' }),
  dc('d_storm_finish', 'medium', 'Storm Rider', 'Finish a Mars level with a dust storm', { stat: 'finishes', value: 1, scope: 'day', filter: 'level.storm>0' }, 'mars'),
  dc('d_quest_1', 'medium', 'Good Samaritan', 'Complete any side quest', { stat: 'questsDone', value: 1, scope: 'day' }),
  dc('d_combo_x4', 'medium', 'Combo Breaker', 'Reach a x4 combo multiplier', { stat: 'maxComboMult', value: 4, scope: 'run' }),
  dc('d_speed_70', 'medium', 'Ludicrous', 'Hit 70 m/s (252 km/h)', { stat: 'maxSpeed', value: 70, scope: 'run' }),
  dc('d_perfect_1', 'hard', 'Bullseye', 'Land a PERFECT landing (within 2.5 m)', { stat: 'perfect', value: 1, scope: 'run' }),
  dc('d_gold_featured', 'hard', 'Gold Rush', 'Get 3 stars on the featured level', { stat: 'stars', value: 3, scope: 'run', level: 'featured' }),
  dc('d_win_race', 'hard', 'Champion', 'Win a race', { stat: 'position', value: 1, cmp: '==', scope: 'run', mode: 'race' }),
  dc('d_score_25k', 'hard', 'Showboat', 'Score 25,000 points in one run', { stat: 'score', value: 25000, scope: 'run' }),
  dc('d_lowbatt', 'hard', 'Running on Fumes', 'Finish with less than 5 s of battery left', { stat: 'batteryLeft', value: 5, cmp: '<', scope: 'run' }),
  dc('d_double_flip', 'hard', 'Double Trouble', 'Land a 2x flip', { stat: 'flipsInOneJump', value: 2, scope: 'run' }, 'moon'),
  dc('d_olympus', 'hard', 'Summit Fever', 'Finish Olympus Ascent or Olympus Mons Descent under silver time', { stat: 'time', value: 'silver', cmp: '<=', scope: 'run', levels: ['r3', 'r7'] }, 'mars'),
  dc('d_tri_planet', 'hard', 'Interplanetary', 'Finish one level on each planet today', { stat: 'planetsFinished', value: 3, scope: 'day' }),
];
W('daily_challenges.json', {
  schema: 'volt-roadster/daily_challenges@1',
  compatWithProgressJs: 'progress.dailyChallenges() already picks 3 of 12 per-run types with a string-hash LCG on local date, rewards 200/300/400 and streak +25%/day (cap 10 days). This pool is a drop-in superset: per-run goals map to dailyCheck(r.stat...), day-scope goals need save.daily.counters. Recommend capping streak at +50% (current cap is +250%).',
  seeding: {
    dayKey: 'UTC date string YYYY-MM-DD (same challenges for everyone, cloud-save friendly)',
    seed: 'fnv1a32("volt-daily:" + dayKey)', rng: 'mulberry32(seed) (src/noise.js rng() is fine if it is seedable)',
    featuredPlanet: "['earth','moon','mars'][daysSinceEpoch % 3]",
    featuredLevel: 'rng pick from featuredPlanet levels, weighted towards levels the player has < 3 stars on',
    pick: '1 easy + 1 medium + 1 hard; a challenge whose planet != any must match featuredPlanet; reject any id used in the previous 5 days (recompute those days deterministically) and re-roll up to 10 times',
    rerolls: '1 free reroll per day per slot; +1 at Scout Tower level 3 (base_building.json)',
    resetAt: '00:00 UTC; show local countdown',
  },
  rewards: { easy: 300, medium: 600, hard: 1000, allThreeBonus: 500, streak: { perDay: 0.1, max: 0.5, graceDays: 1 }, weeklyChest: { completionsNeeded: 15, coins: 3000, cosmeticChance: 0.5 } },
  trackingNeeds: 'Per-day counters persisted in the save (coins, loops, carJumps, gaps, finishes, nearMiss, drift, flips, rolls, pads, questsDone, planetsFinished); per-run values come from sim.result.stat + result.position/score/stars/time. New stats needed: pads (count pad events), maxComboMult, flipsInOneJump, batteryLeft.',
  count: dailies.length, pool: dailies });

// ======================= ECONOMY =======================


// Game Maker decision (Oct 18): maxing the 6 core tracks costs ~120k coins (core max ~12 h of play).
const CORE_TARGET = 120000;
const CORE_MULS = { tank: 1.0, speed: 1.15, accel: 1.0, handling: 0.9, boost: 0.9, thruster: 1.1 };
const COST10 = [250, 450, 750, 1150, 1700, 2450, 3400, 4600, 6100, 8000];
const COST8 = [300, 600, 1000, 1600, 2400, 3500, 5000, 7000];
const RAW_CORE = Object.entries(CORE_MULS).reduce((a, [k, m]) => a + (k === 'thruster' ? COST8 : COST10).reduce((x, y) => x + y, 0) * m, 0);
const UPG_SCALE = CORE_TARGET / RAW_CORE;   // ≈0.72 (was 1.8 when the core max was ~300k / ~35 h)
const BASE_SCALE = UPG_SCALE / 1.8;         // magnet uses UPG_SCALE; buildings + robots scaled by the same ratio as the core rescale
const tierCosts = (arr, mul) => arr.map(c => Math.round(c * mul * UPG_SCALE / 10) * 10);
const track = (key, name, desc, tiers, mul, statFn, simKey) => {
  const costs = tierCosts(tiers, mul);
  return { key, name, desc, simKey, maxTier: costs.length, totalCost: costs.reduce((a, b) => a + b, 0),
    tiers: costs.map((c, i) => ({ tier: i + 1, cost: c, ...statFn(i + 1) })) };
};
const r2 = x => Math.round(x * 100) / 100;
const upgrades = [
  track('tank', 'Battery Tank', 'Longer runs: +12 s of battery per tier.', COST10, 1.0, l => ({ stats: { tank: 60 + 12 * l }, delta: '+12 s tank' }), "up.tank -> carStats().tank = 60 + 12*l"),
  track('speed', 'Top Speed', 'Higher top speed: +6 m/s (21.6 km/h) per tier. Max 112 m/s ≈ 403 km/h.', COST10, 1.15, l => ({ stats: { vmax: 52 + 6 * l, kmh: Math.round((52 + 6 * l) * 3.6) }, delta: '+6 m/s vmax' }), "up.speed -> vmax = 52 + 6*l"),
  track('accel', 'Acceleration', 'Quicker launches and loop entries: +1.5 m/s² per tier.', COST10, 1.0, l => ({ stats: { accel: r2(10 + 1.5 * l), zeroTo100kmh: r2(27.8 / (10 + 1.5 * l)) }, delta: '+1.5 m/s^2' }), "up.accel -> accel = 10 + 1.5*l"),
  track('handling', 'Handling & Grip', 'Tyre grip + steering (grip is folded in here). Also reduces dust-storm grip loss.', COST10, 0.9, l => ({ stats: { grip: r2(3.1 + 0.35 * l), steer: r2(0.42 + 0.03 * l), stormGripRecovery: r2(0.03 * l) }, delta: '+0.35 grip, +0.03 steer' }), "up.handling -> grip = 3.1+0.35*l, steer = 0.42+0.03*l"),
  track('boost', 'Boost', 'Stronger and longer boost.', COST10, 0.9, l => ({ stats: { boostMul: r2(1.5 + 0.1 * l), boostCap: r2(2.6 + 0.6 * l) }, delta: '+0.1 boostMul, +0.6 s capacity' }), "up.boost -> boostMul = 1.5+0.1*l, boostCap = 2.6+0.6*l"),
  track('thruster', 'Thrusters (Air Control)', 'Higher jump, longer mid-air thrust and stronger air control for precision landings.', COST8, 1.1,
    l => ({ stats: { jumpV: r2(5.5 + 0.8 * l), thrustCap: r2(1.0 + 0.3 * l), airControlMul: r2(1 + 0.06 * l) }, delta: '+0.8 m/s jump, +0.3 s thrust, +6% air torque' }),
    "up.thruster -> jumpV = 5.5+0.8*l; thrustCap = 1.0+0.3*l (DECIDED by Game Maker: 0.3 s per tier, replaces sim.carStats 0.5*l); airControlMul is new (scales the 5.5 torque constant in sim air control)"),
];
const magnet = track('magnet', 'Coin Magnet (optional perk)', 'Pulls coins in from further away.', COST8, 0.6, l => ({ stats: { pickupRadius: r2(3.4 + 0.9 * l) }, delta: '+0.9 m pickup radius' }), 'NEW: sim pickup check uses 3.4 m radius; replace with stats.magnet');
// base building costs (sink) taken from base_building below; define buildings first
const robots = {
  family: 'VOLT-Bots (original design)',
  look: 'Slim humanoid helpers, ~1.7 m, matte pearl-white shells with a single wraparound cyan light-bar visor, exposed graphite joints, a glowing amber battery core in the chest and role-coloured shoulder pads. No logos, no resemblance to any real product name.',
  roles: [
    { role: 'miner', name: 'Dig', color: 'amber', benefit: 'Staffs a Mine/Drill building: passive coins per hour', simHook: 'none (meta)', costs: [600, 1500, 3000, 5000], maxPerPlanet: 2 },
    { role: 'mechanic', name: 'Wrench', color: 'red', benefit: '-3% upgrade cost per mechanic (cap -15%); free tyre swap = +2% grip for the next run', simHook: 'economy discount; bonus.grip optional', costs: [800, 2000, 3500, 6000], maxPerPlanet: 2 },
    { role: 'charger', name: 'Juice', color: 'green', benefit: '+1 s battery at every checkpoint per charger (cap 4)', simHook: 'opts.robots -> sim.robots (checkpoint bonus = 3 + robots)', costs: [700, 1700, 3200, 5500], maxPerPlanet: 2 },
    { role: 'scout', name: 'Peep', color: 'violet', benefit: 'Reveals side quests + gold coin caches on the minimap; +1 daily reroll at 2 scouts', simHook: 'minimap layer; daily rerolls', costs: [500, 1300, 2600, 4500], maxPerPlanet: 1 },
  ],
  cap: { total: 21, note: 'robot n of a role costs costs[min(n, 3)]' },
};
const bld = (id, planet, name, role, levels, desc) => ({ id, planet, name, staffedBy: role, desc, levels });
robots.roles.forEach(r => { r.costs = r.costs.map(c => Math.round(c * BASE_SCALE / 10) * 10); });
const L = (lvl, cost, buildMin, benefit) => ({ level: lvl, cost: Math.round(cost * BASE_SCALE / 10) * 10, buildMinutes: buildMin, benefit });
const buildings = [
  bld('earth_garage', 'earth', 'Roadside Garage HQ', 'mechanic', [L(1, 0, 0, 'Home base. 1 mechanic slot.'), L(2, 1500, 10, '2 mechanic slots, paint shop'), L(3, 4000, 45, 'Upgrade costs -5% (stacks with mechanics, total cap -20%)'), L(4, 9000, 120, 'Ghost replays of your best runs on all levels'), L(5, 16000, 240, 'Garage showroom (cosmetic) + -5% more')], 'Where your Roadster lives. Mechanics work here.'),
  bld('earth_solar_carport', 'earth', 'Solar Carport', 'charger', [L(1, 800, 5, '+2 s starting battery'), L(2, 2500, 30, '+4 s starting battery, 1 charger slot'), L(3, 6000, 90, '+6 s, 2 charger slots'), L(4, 12000, 180, '+8 s, battery pickups +2 s')], 'Free sunshine for your battery.'),
  bld('robot_workshop', 'earth', 'Robot Workshop', null, [L(1, 1000, 10, 'Build robots (2 at a time)'), L(2, 3500, 60, 'Robot build time -25%, 4 robots in queue'), L(3, 9000, 180, 'Robots gain moods/quests (Robot Feelings side quest)')], 'Builds VOLT-Bots for every planet (robots are shipped by rocket, so they can work anywhere).'),
  bld('earth_scout_tower', 'earth', 'Scout Tower', 'scout', [L(1, 1200, 15, 'Minimap shows side quest givers'), L(2, 3500, 60, 'Minimap shows gold coin caches'), L(3, 8000, 150, '+1 daily challenge reroll')], 'Eyes in the sky.'),
  bld('moon_regolith_mine', 'moon', 'Regolith Mine', 'miner', [L(1, 1500, 15, '10 coins/h per staffed miner'), L(2, 4000, 60, '20 coins/h'), L(3, 8500, 150, '32 coins/h'), L(4, 15000, 240, '46 coins/h')], 'Helium-3 flavoured coins. Do not ask how.'),
  bld('moon_habitat', 'moon', 'Habitat Dome', 'charger', [L(1, 1200, 10, '1 charger slot on Moon levels (+1 s per checkpoint)'), L(2, 4000, 60, 'Low-g landing assist +10% (air torque damping)'), L(3, 9000, 180, 'Moon levels: battery drains 10% slower in the air')], 'Somewhere to keep your helmet.'),
  bld('moon_mass_driver', 'moon', 'Mass Driver', null, [L(1, 5000, 90, 'Unlocks the Mass Driver daily stunt (launch the Roadster into a crater target)'), L(2, 12000, 240, 'Ships miner coins from all planets: offline cap 6 h -> 10 h')], 'A railgun for cars. Totally safe.'),
  bld('mars_ice_drill', 'mars', 'Polar Ice Drill', 'miner', [L(1, 1800, 20, '12 coins/h per staffed miner'), L(2, 4800, 75, '24 coins/h'), L(3, 10000, 180, '38 coins/h'), L(4, 17000, 240, '55 coins/h')], 'Water is the real Mars currency.'),
  bld('mars_dust_shield', 'mars', 'Dust Shield Array', null, [L(1, 2500, 30, 'Dust storms: gripMul penalty -25%'), L(2, 7000, 120, 'penalty -50%, visibility +150 m'), L(3, 14000, 240, 'penalty -75%, minimap no longer fuzzes in storms')], 'Pushes the storm back a little. Feeds stormFx in levels.mars.json.'),
  bld('mars_greenhouse', 'mars', 'Greenhouse', 'scout', [L(1, 1500, 15, 'Potatoes! +5% coins on Mars levels'), L(2, 5000, 90, '+10%, DJ Phobos appears (Martian DJ quest)'), L(3, 11000, 210, '+15%, cosmetic: potato antenna topper')], 'Botanist Mark approves.'),
];
const bTotal = buildings.reduce((a, b) => a + b.levels.reduce((x, y) => x + y.cost, 0), 0);
const rTotal = robots.roles.reduce((a, r) => a + Array.from({ length: r.maxPerPlanet * 3 }, (_, n) => r.costs[Math.min(n, 3)]).reduce((x, y) => x + y, 0), 0);

// ---- income model ----
const avgCoins = Math.round(ALL.reduce((a, l) => a + l.coins.estimatedValue, 0) / ALL.length);
const starBonus = d => [150, 150, 150];
const firstTimePool = ALL.reduce((a, l) => a + starBonus(l.diff).reduce((x, y) => x + y, 0) + (l.quest?.reward || 0), 0)
  + quests.reduce((a, q) => a + (q.status === 'needs-code' ? q.reward.coins : 0), 0)
  + races.events.reduce((a, e) => a + e.rewards.firstWinBonus + e.rewards.coinsByPosition[0], 0);
const income = {
  perRun: { collectedCoins: `≈${avgCoins} coins available per run (auto-placed + bonus arcs/rings, from levels.*.json); expect 55% early -> 85% late (skill + magnet)`,
    trickCoins: 'floor(result.score/120) (= progress.applyResult earn.score)', crashPenalty: 'none (no coin loss; fail = keep collected coins)' },
  firstTime: { starBonus: '150 per newly earned star (= progress.applyResult); optional proposal: scale by (0.8+0.2*diff)', questReward: 'level quest.reward (250-550), repeats pay 25% (= progress.applyResult)', races: 'see races.json', poolTotal: firstTimePool },
  daily: 'daily_challenges.json: 300/600/1000 + 500 for all three, streak up to +50%, weekly chest 3000',
  passive: 'base_building.json miners (coins/h, offline cap 6 h, 10 h with Mass Driver 2)',
  sinks: { upgrades: upgrades.reduce((a, t) => a + t.totalCost, 0), magnetPerk: magnet.totalCost, buildings: bTotal, robots: rTotal, cosmetics: 'optional, earned not bought (no shop pressure)' },
};
// pacing simulation: 20-min sessions = 6 runs, 2 sessions/day
const sim = (baseW = 1.5) => {
  const goods = [];
  for (const t of [...upgrades, magnet]) t.tiers.forEach(x => goods.push({ track: t.key, tier: x.tier, cost: x.cost, w: t.key === 'magnet' ? 1.3 : 1 }));
  for (const b of buildings) b.levels.forEach(x => x.cost && goods.push({ track: 'base:' + b.id, tier: x.level, cost: x.cost, w: baseW }));
  for (const r of robots.roles) for (let n = 0; n < r.maxPerPlanet * 3; n++) goods.push({ track: 'robot:' + r.role, tier: n + 1, cost: r.costs[Math.min(n, 3)], w: baseW });
  const owned = { 'base:earth_garage': 1 }; let coins = 0, pool = firstTimePool, minerRate = 0; const log = [], firstBuy = {}, maxed = {}, buys = [];
  const nextFor = k => goods.find(g => g.track === k && g.tier === (owned[k] || 0) + 1);
  for (let s = 1; s <= 200; s++) {
    const skill = Math.min(0.85, 0.55 + s * 0.006) + Math.min(0.1, (owned.magnet || 0) * 0.0125);
    const runs = 6, perRun = avgCoins * skill + Math.min(220, 60 + s * 2); // collected coins + score/120 (avg run score ~7k early -> ~26k late)
    const ft = Math.min(pool, 3300); pool -= ft; // ~5-6 first clears (stars + quest) per early session
    const daily = (300 + 600 + 1000 + 500) * Math.min(1, 0.45 + s * 0.02) / 2 + 3000 / 14 * 0.6;
    const passive = minerRate * 6;
    const earned = runs * perRun + ft + daily + passive; coins += earned;
    let bought = [];
    for (;;) { // buy cheapest affordable next tier (weighted)
      const cands = [...new Set(goods.map(g => g.track))].map(nextFor).filter(Boolean).sort((a, b) => a.cost * a.w - b.cost * b.w);
      const c = cands[0]; if (!c || c.cost > coins) break;
      coins -= c.cost; owned[c.track] = c.tier; bought.push(`${c.track}${c.tier}`); firstBuy[c.track] ??= s;
      if (!nextFor(c.track)) maxed[c.track] = s;
      if (c.track === 'base:moon_regolith_mine') minerRate = [0, 10, 20, 32, 46][c.tier] * 2 + (owned['base:mars_ice_drill'] ? [0, 12, 24, 38, 55][owned['base:mars_ice_drill']] * 2 : 0);
      if (c.track === 'base:mars_ice_drill') minerRate = [0, 12, 24, 38, 55][c.tier] * 2 + (owned['base:moon_regolith_mine'] ? [0, 10, 20, 32, 46][owned['base:moon_regolith_mine']] * 2 : 0);
    }
    buys.push(bought.length);
    if ([1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 140, 160].includes(s)) log.push({ session: s, hours: Math.round(s / 3 * 10) / 10, earnedThisSession: Math.round(earned), purchases: bought.length, tiers: Object.fromEntries(['tank', 'speed', 'accel', 'handling', 'boost', 'thruster', 'magnet'].map(k => [k, owned[k] || 0])), baseLevels: Object.entries(owned).filter(([k]) => k.startsWith('base:')).reduce((a, [, v]) => a + v, 0) + '/' + buildings.reduce((a, b) => a + b.levels.length, 0), minerCoinsPerHour: minerRate });
    if (Object.keys(maxed).length === new Set(goods.map(g => g.track)).size) { log.push({ session: s, hours: Math.round(s / 3 * 10) / 10, note: 'everything maxed (upgrades + magnet + buildings + all 21 robots)' }); break; }
  }
  const earlyGaps = buys.slice(0, 20);
  return { log, maxed, firstBuy, earlySessionsWithAPurchase: earlyGaps.filter(x => x > 0).length + '/20' };
};
const pace = sim(1.5); pace.allMaxedSession = pace.log.find(r => r.note)?.session;
const paceCore = sim(1e6); // core-first player: buys base/robots only after the car is maxed
const pacing = {
  assumptions: 'Session = 20 min = 6 runs; 2 sessions/day; player buys the cheapest next item, weighting car upgrades first (base/robot prices x1.5, magnet x1.3 when ranking); skill-based coin pickup 55%->85%; first-time rewards (stars, quests, race first-wins) paid at up to 3,300 per session until the pool is empty.',
  table: pace.log,
  sessionsToMax: Object.fromEntries(['tank', 'speed', 'accel', 'handling', 'boost', 'thruster', 'magnet'].map(k => [k, { firstTier: pace.firstBuy[k], maxed: pace.maxed[k], hoursToMax: Math.round(pace.maxed[k] / 3 * 10) / 10 }])),
  earlySessionsWithAPurchase: pace.earlySessionsWithAPurchase,
  everythingMaxed: pace.log.find(r => r.note) || 'not within 200 sessions',
  coreFirstProfile: { note: 'same income, player ignores base/robots until all car tracks are maxed', coreMaxHours: Math.round(Math.max(...['tank', 'speed', 'accel', 'handling', 'boost', 'thruster'].map(k => paceCore.maxed[k])) / 3 * 10) / 10, sessionsToMax: Object.fromEntries(['tank', 'speed', 'accel', 'handling', 'boost', 'thruster', 'magnet'].map(k => [k, paceCore.maxed[k]])), everythingMaxed: paceCore.log.find(r => r.note), earlySessionsWithAPurchase: paceCore.earlySessionsWithAPurchase },
  summary: { coreMaxHoursBalanced: Math.round(10 * Math.max(...['tank', 'speed', 'accel', 'handling', 'boost', 'thruster'].map(k => pace.maxed[k])) / 3) / 10, coreMaxHoursCoreFirst: Math.round(10 * Math.max(...['tank', 'speed', 'accel', 'handling', 'boost', 'thruster'].map(k => paceCore.maxed[k])) / 3) / 10, everythingMaxHours: Math.round((pace.log.find(r => r.note)?.session ?? 0) / 3 * 10) / 10, target: 'core ~120k coins / ~12 h (Game Maker, Oct 18): balanced and core-first players bracket 12 h' },
  noPaywall: ['No premium currency, no timers you can pay to skip, no energy system', 'Build timers can be cut 30 min per finished run (playing is the accelerator)', 'Crashing or failing never costs coins', 'Every level is completable at tier 0 with skill (all gap minTakeoffSpeed <= 46 m/s except Grand Gulch 44 / Summit Launch 44 which need a short boost; base vmax 52, boost 66)'],
};
W('economy.json', { schema: 'volt-roadster/economy@1', currency: 'coins', saveKeys: { upgrades: 'save.upgrades = { tank, speed, accel, handling, boost, thruster, magnet } (ints, 0 = stock) -> passed as carStats(up, bonus)' },
  upgradeTracks: upgrades, optionalPerks: [magnet], income, pacing,
  levelRewards: ALL.map(l => ({ id: l.id, diff: l.diff, starBonus: starBonus(l.diff), quest: l.quest?.reward || 0, coinsAvailable: l.coins.estimatedValue })) });
W('base_building.json', { schema: 'volt-roadster/base_building@1', unlocked: 'all three bases available from the start (req 21); Earth Garage HQ is pre-built',
  compatWithProgressJs: {
    model: 'src/progress.js uses 6 plots per planet (save.bases[planet].plots = [{type, lvl}]) and BUILDINGS solar/refinery/robotbay/workshop/nitro/trophy. Keep that model; this file adds planet flavour, robot roles and new types.',
    mapping: { earth_garage: 'workshop', earth_solar_carport: 'solar', robot_workshop: 'robotbay', moon_regolith_mine: 'refinery', mars_ice_drill: 'refinery', moon_habitat: 'solar (Moon skin) + new air-drain perk', earth_scout_tower: 'NEW type scout', moon_mass_driver: 'NEW type massdriver', mars_dust_shield: 'NEW type dustshield', mars_greenhouse: 'NEW type greenhouse' },
    keepFromProgressJs: ['nitro (Nitro Plant)', 'trophy (Trophy Hall)'],
    robots: 'progress.robotCount(s) = sum of robotbay levels; roles here are an assignment of those robots (save.robots = [{role, planet}]). Chargers -> Sim opts.robots.',
    costNote: 'Costs here are scaled with the 120k core-upgrade economy (BASE_SCALE in gen/build_meta.mjs). progress.js building costs (300-1600) were tuned for MAX_UP=5; replace them with these when moving to 10 tiers.',
  },
  robots, buildings,
  buildTimers: { realTime: true, maxMinutes: 240, accelerate: 'each finished run cuts 30 min off every active build; staffed robots of the matching role cut build time 15%', noPaidSkip: true, offline: 'timers continue offline (timestamp in save, cloud-synced)' },
  passiveIncome: { formula: 'sum over planets: rate[level] * min(staffedMiners,2) coins/h', offlineCapHours: 6, offlineCapWithMassDriver2: 10, collect: 'auto-collected on next visit to the base screen' },
  feedbackIntoCar: [
    { source: 'charger robots (Juice)', effect: 'sim opts.robots = total chargers (cap 4) -> +1 s battery per checkpoint each', file: 'src/sim.js Sim constructor opts.robots / rules() checkpoint bonus' },
    { source: 'Solar Carport', effect: 'bonus.tank += 2/4/6/8 s', file: 'carStats(up, bonus) bonus.tank' },
    { source: 'mechanic robots + Garage HQ', effect: 'upgrade cost discount (cap -20%)', file: 'economy upgrade purchase' },
    { source: 'Dust Shield Array', effect: 'reduces stormFx.gripMul penalty / fog on Mars', file: 'levels.mars.json stormFx' },
    { source: 'Habitat Dome', effect: 'Moon air drain -10% (battery drain constant 0.3 in rules())', file: 'src/sim.js rules() battery' },
    { source: 'Greenhouse', effect: '+5/10/15% coin income on Mars', file: 'economy run payout' },
    { source: 'miners (Dig)', effect: 'passive coins -> more upgrades', file: 'economy' },
  ],
  totals: { buildingCosts: bTotal, robotCosts: rTotal } });
console.log(JSON.stringify({ firstTimePool, avgCoins, bTotal, rTotal, sinks: income.sinks, pacing: pacing.sessionsToMax, early: pace.earlySessionsWithAPurchase, last: pace.log.at(-1) }, null, 1));
