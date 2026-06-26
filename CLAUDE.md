# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev     # dev server at http://localhost:3000
npm run build   # production build → dist/
npm test        # run all tests (Vitest)
npx vitest run tests/collision.test.js   # run single test file
```

## Architecture

Vite + Vanilla JS ES modules + Three.js r165. No framework. Single HTML page. All game logic in `src/`, pure functions testable without DOM in `tests/`.

**State ownership:** `gameState` is a plain object created in `main.js` via `makeGameState()` and passed by reference to every module. Modules mutate it directly — no event bus, no reactive system. Modules never own state across restarts; `main.js` replaces `gameState` and calls each module's `reset()`.

**Game loop:** `renderer.setAnimationLoop()` in `main.js`. Order each frame: `updateScene → playerApi.update → obstacleApi.update → collectibleApi.update → checkCollisions → drone/particle updates → updateHud`.

**Module pattern:** Each `initFoo(scene, ...)` returns an API object `{ update, reset, ... }`. Modules hold their Three.js objects in closure. No classes.

**Collision system:** All collidables expose `getAABB() → THREE.Box3`. `boxesOverlap(a, b)` uses strict `<`/`>` (touching edges = false). Obstacles use `userData.hazardAABB` (local-space offsets) applied at runtime: `pos.x + hz.minX` etc. — never `setFromObject` on obstacle groups. The Z collision window is `−2 ≤ obs.z ≤ 3`.

**Object pooling:** `initObstacles` pre-builds all pool slots at init (no mesh rebuild on spawn). `spawnOne()` resets position/state only. Pool size 12, cycling through 5 obstacle types. Collectibles have a separate shard pool (30) + 4 power-up slots.

**Score:** `gameState.score = Math.floor(gameState.distance) + gameState.shardBonus`. Never set score directly — add to `shardBonus` for shard pickups.

**Key constants** (`src/constants.js`): `LANES = [-2.5, 0, 2.5]`, `JUMP_VELOCITY = 10`, `GRAVITY = -22`, `INVINCIBLE_DURATION = 0.8`, `SLIDE_DURATION = 0.6`.

**Player AABB:** `x ± 0.28`, z `[−0.25, 0.25]`, height 1.8 running / 0.9 sliding. `group.position.y` is the player's feet Y (0 = ground).

**HOVER power-up:** player floats at `yPos = 1.5`. On expiry, if `yPos > 0` and not already jumping, sets `action = 'JUMPING'` with `yVelocity = 0` to fall naturally.

**LASER_GATE:** beam blinks via `Math.sin`; collision is skipped when `beam.visible === false`.

**Drone proximity:** `calcProximityDelta` in `drone.js` is a pure function returning a raw delta (not multiplied by frame delta for hit/evade signals). Clamped to `[0, 1]` in `main.js`.

**Audio:** Web Audio API only, no external files. `initAudio()` returns `{ play(event, ...args) }`. All sounds synthesized via `OscillatorNode`.

**Tests:** Only pure functions are unit-tested (`boxesOverlap`, `calcProximityDelta`, constants). Three.js scene modules are not mocked — tests import them directly since Three.js works in Node via Vitest.
