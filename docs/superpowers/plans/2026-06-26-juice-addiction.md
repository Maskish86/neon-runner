# Juice & Addiction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add initial speed bump, combo multiplier, camera shake, hit slow-mo, and highscore polish to make the game more exhilarating and addictive.

**Architecture:** All new state lives in `gameState` (plain object in `main.js`). `main.js` owns the real-time game loop split (`realDelta` vs scaled `delta`). Each feature modifies one or two existing files; no new files.

**Tech Stack:** Vite + Vanilla JS + Three.js r165. Web Audio API. localStorage (no server).

## Global Constraints

- No new modules/files — extend existing ones only
- No `setFromObject` on obstacle groups (AABB policy)
- Tests: pure functions only (Vitest). Three.js scene modules import fine in Node.
- `localStorage` key for highscore: `neon-runner-highscore` (already in use — do not change)
- `gameState` is passed by reference; modules mutate it directly

---

## File Map

| File | Changes |
|------|---------|
| `src/constants.js` | `BASE_SPEED` 8→12 |
| `src/main.js` | New `gameState` fields; `realDelta`/`delta` split; camera shake loop; landing detection; combo reset on hit; slow-mo trigger |
| `src/collectibles.js` | `collect()` increments combo + resets comboTimer; `update()` ticks/resets comboTimer; shard score `10 * combo` |
| `src/hud.js` | Combo display div + timer bar; `updateHud` renders combo; `showScreen('GAME_OVER')` shows NEW BEST!; title screen reads localStorage |
| `src/style.css` | `.combo-bar`, `@keyframes combo-pop` styles |

---

## Task 1: Speed bump + gameState new fields + slow-mo

**Files:**
- Modify: `src/constants.js`
- Modify: `src/main.js`

**Interfaces:**
- Produces: `gameState.combo` (number, 1–4), `gameState.comboTimer` (number, seconds), `gameState.timeScale` (number, 0.25–1.0), `gameState.slowTimer` (number, real seconds remaining), `gameState.cameraShake` (`{intensity:number, duration:number}`)

- [ ] **Step 1: Change BASE_SPEED**

In `src/constants.js`, change:
```js
export const BASE_SPEED = 8
```
to:
```js
export const BASE_SPEED = 12
```

- [ ] **Step 2: Add new fields to makeGameState()**

In `src/main.js`, find `makeGameState` and replace the return object:
```js
function makeGameState(skinColor = 'CYAN') {
  return {
    status: 'TITLE',
    score: 0, shardBonus: 0, distance: 0, speed: BASE_SPEED, hp: 3,
    skinColor,
    player: {
      lane: 1, targetLane: 1, laneT: 1,
      action: 'RUNNING', queuedLane: null,
      yPos: 0, yVelocity: 0,
      slideTimer: 0, invincibleTimer: 0,
    },
    powerUp: null,
    droneProximity: 0,
    combo: 1,
    comboTimer: 0,
    timeScale: 1.0,
    slowTimer: 0,
    cameraShake: { intensity: 0, duration: 0 },
  }
}
```

- [ ] **Step 3: Split realDelta / scaled delta and add slow-mo logic**

In `src/main.js`, find the game loop and replace the delta calculation + PLAYING block opening:

Current:
```js
let last = performance.now()
renderer.setAnimationLoop(() => {
  const now = performance.now()
  const delta = Math.min((now - last) / 1000, 0.05)
  last = now

  if (gameState.status === 'PLAYING') {
    gameState.distance += gameState.speed * delta
    gameState.speed = Math.min(MAX_SPEED, BASE_SPEED + gameState.distance * ACCEL_FACTOR)
    gameState.score = Math.floor(gameState.distance) + gameState.shardBonus
```

Replace with:
```js
let last = performance.now()
renderer.setAnimationLoop(() => {
  const now = performance.now()
  const realDelta = Math.min((now - last) / 1000, 0.05)
  last = now

  // slow-mo timer counts down in real time, not game time
  if (gameState.slowTimer > 0) {
    gameState.slowTimer -= realDelta
    if (gameState.slowTimer <= 0) {
      gameState.slowTimer = 0
      gameState.timeScale = 1.0
    }
  }
  const delta = realDelta * gameState.timeScale

  if (gameState.status === 'PLAYING') {
    gameState.distance += gameState.speed * delta
    gameState.speed = Math.min(MAX_SPEED, BASE_SPEED + gameState.distance * ACCEL_FACTOR)
    gameState.score = Math.floor(gameState.distance) + gameState.shardBonus
```

- [ ] **Step 4: Verify game still runs**

```bash
npm run dev
```
Open http://localhost:3000 — game should start faster. No errors in console.

- [ ] **Step 5: Run tests**

```bash
npm test
```
Expected: all pass (no test changes needed for this task).

- [ ] **Step 6: Commit**

```bash
git add src/constants.js src/main.js
git commit -m "feat: speed 8→12, gameState combo/timeScale/shake fields, slow-mo delta split"
```

---

## Task 2: Camera shake

**Files:**
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `gameState.cameraShake: {intensity:number, duration:number}` (from Task 1)
- Produces: Camera visually shakes on hit (intensity 0.15, 0.3s) and on landing (intensity 0.06, 0.1s)

- [ ] **Step 1: Add camera shake state and base position**

In `src/main.js`, after the camera is created (`camera.position.set(0, 4, 8)`), add:
```js
const CAM_BASE_X = 0
const CAM_BASE_Y = 4
```

- [ ] **Step 2: Add shake loop inside PLAYING block**

In `src/main.js`, inside the `if (gameState.status === 'PLAYING')` block, add camera shake processing **after** `droneApi.updateCapture(delta)` and the capture-trigger block, just before `updateHud(gameState)`:
```js
    // camera shake
    if (gameState.cameraShake.duration > 0) {
      camera.position.x = CAM_BASE_X + (Math.random() - 0.5) * gameState.cameraShake.intensity
      camera.position.y = CAM_BASE_Y + (Math.random() - 0.5) * gameState.cameraShake.intensity
      gameState.cameraShake.duration -= realDelta
      if (gameState.cameraShake.duration <= 0) {
        gameState.cameraShake.duration = 0
        camera.position.x = CAM_BASE_X
        camera.position.y = CAM_BASE_Y
      }
    }
```

Note: use `realDelta` (not scaled `delta`) so shake duration is always in real time.

- [ ] **Step 3: Trigger shake on obstacle hit**

In `src/main.js`, inside the `if (hitObstacle)` block, after `gameState.player.invincibleTimer = INVINCIBLE_DURATION`, add:
```js
        gameState.cameraShake = { intensity: 0.15, duration: 0.3 }
```

For the SHIELD case (absorbs hit), add a smaller shake:
```js
      if (gameState.powerUp?.type === 'SHIELD') {
        gameState.powerUp = null
        gameState.player.invincibleTimer = INVINCIBLE_DURATION
        gameState.cameraShake = { intensity: 0.08, duration: 0.15 }
```

- [ ] **Step 4: Detect jump landing and trigger shake**

In `src/main.js`, capture `yPos` before and after player update to detect landing:

Find:
```js
    updateScene(delta, gameState.speed)
    playerApi.update(delta, gameState)
    obstacleApi.update(delta, gameState)
```

Replace with:
```js
    updateScene(delta, gameState.speed)
    const prevYPos = gameState.player.yPos
    playerApi.update(delta, gameState)
    if (prevYPos > 0.05 && gameState.player.yPos <= 0 && gameState.player.action !== 'SLIDING') {
      gameState.cameraShake = { intensity: 0.06, duration: 0.1 }
    }
    obstacleApi.update(delta, gameState)
```

- [ ] **Step 5: Verify shake works**

```bash
npm run dev
```
- Jump → land: subtle shake
- Hit obstacle: strong shake
- Console: no errors

- [ ] **Step 6: Commit**

```bash
git add src/main.js
git commit -m "feat: camera shake on hit (0.15/0.3s) and landing (0.06/0.1s)"
```

---

## Task 3: Hit slow-mo

**Files:**
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `gameState.timeScale`, `gameState.slowTimer` (from Task 1); `realDelta` (from Task 1)
- Produces: 0.2s of 0.25x time scale on obstacle hit

- [ ] **Step 1: Trigger slow-mo on obstacle hit**

In `src/main.js`, inside the `if (hitObstacle)` else block (non-SHIELD hit), after `gameState.player.invincibleTimer = INVINCIBLE_DURATION`, add:
```js
        gameState.timeScale = 0.25
        gameState.slowTimer = 0.2
```

Full context for the else block after this change:
```js
      } else {
        particleApi.burstHit(playerApi.group.position.clone())
        try { audioApi.play('hit') } catch(e) {}
        gameState.hp -= 1
        gameState.player.invincibleTimer = INVINCIBLE_DURATION
        gameState.cameraShake = { intensity: 0.15, duration: 0.3 }
        gameState.timeScale = 0.25
        gameState.slowTimer = 0.2
        if (gameState.hp <= 0) {
          gameState.status = 'GAME_OVER'
          showScreen('GAME_OVER', gameState)
        }
      }
```

- [ ] **Step 2: Verify slow-mo works**

```bash
npm run dev
```
Hit an obstacle — game should slow to a crawl for ~0.2 real seconds then return to normal speed.

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat: 0.25x slow-mo for 0.2s on obstacle hit"
```

---

## Task 4: Combo multiplier

**Files:**
- Modify: `src/collectibles.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `gameState.combo` (number, 1–4), `gameState.comboTimer` (number) from Task 1
- Produces: `gameState.combo` incremented on shard collect; reset on hit or 2s gap; `shardBonus += 10 * combo`

- [ ] **Step 1: Update collect() to manage combo**

In `src/collectibles.js`, find the `collect` function:
```js
  function collect(item, gameState) {
    item.entry.mesh.visible = false
    item.entry.active = false
    if (item.type === 'SHARD') {
      gameState.shardBonus += 10
    } else {
```

Replace with:
```js
  function collect(item, gameState) {
    item.entry.mesh.visible = false
    item.entry.active = false
    if (item.type === 'SHARD') {
      gameState.combo = Math.min(4, gameState.combo + 1)
      gameState.comboTimer = 0
      gameState.shardBonus += 10 * gameState.combo
    } else {
```

- [ ] **Step 2: Tick comboTimer and reset combo in update()**

In `src/collectibles.js`, at the start of the `update(delta, gameState)` function body, after `if (gameState.status !== 'PLAYING') return`, add:
```js
    gameState.comboTimer += delta
    if (gameState.comboTimer > 2.0) {
      gameState.combo = 1
      gameState.comboTimer = 0
    }
```

- [ ] **Step 3: Reset combo on obstacle hit**

In `src/main.js`, inside the `if (hitObstacle)` else block, after `gameState.timeScale = 0.25`, add:
```js
        gameState.combo = 1
        gameState.comboTimer = 0
```

- [ ] **Step 4: Write pure-function test for combo score**

Create `tests/combo.test.js`:
```js
import { describe, it, expect } from 'vitest'

// mirrors the logic in collectibles.js collect()
function shardScore(combo) {
  return 10 * Math.min(4, combo)
}

function nextCombo(current) {
  return Math.min(4, current + 1)
}

describe('combo scoring', () => {
  it('base combo gives 10 points', () => {
    expect(shardScore(1)).toBe(10)
  })
  it('combo 2 gives 20 points', () => {
    expect(shardScore(2)).toBe(20)
  })
  it('combo 4 gives 40 points', () => {
    expect(shardScore(4)).toBe(40)
  })
  it('combo caps at 4', () => {
    expect(nextCombo(4)).toBe(4)
    expect(shardScore(nextCombo(4))).toBe(40)
  })
  it('combo 5 is capped to 4', () => {
    expect(shardScore(5)).toBe(40)
  })
})
```

- [ ] **Step 5: Run tests**

```bash
npm test
```
Expected: all pass including new combo tests.

- [ ] **Step 6: Verify combo in-game**

```bash
npm run dev
```
Collect 3+ shards quickly → score should increase faster. Let 2 seconds pass → combo resets.

- [ ] **Step 7: Commit**

```bash
git add src/collectibles.js src/main.js tests/combo.test.js
git commit -m "feat: combo multiplier x1-x4, 2s timeout, reset on hit, test coverage"
```

---

## Task 5: HUD combo display + highscore polish

**Files:**
- Modify: `src/hud.js`
- Modify: `src/style.css`

**Interfaces:**
- Consumes: `gameState.combo` (1–4), `gameState.comboTimer` (0–2.0) from Tasks 1+4
- Produces: combo HUD element visible when combo≥2; timer bar; NEW BEST! on game-over; BEST on title reads localStorage

- [ ] **Step 1: Add combo element to initHud()**

In `src/hud.js`, find `initHud` and replace its `hudEl.innerHTML` with:
```js
export function initHud() {
  hudEl.innerHTML = `
    <div id="hud-score">SCORE: 0</div>
    <div id="hud-dist">0m</div>
    <div id="hud-hi">BEST: 0</div>
    <div id="hud-hp">♥♥♥</div>
    <div id="hud-powerup"></div>
    <div id="hud-combo" style="display:none">
      <span id="hud-combo-text">×2 COMBO</span>
      <div id="hud-combo-bar-wrap"><div id="hud-combo-bar"></div></div>
    </div>
    <div id="hud-drone-warn">⚠ DRONE CLOSING IN ⚠</div>
  `
}
```

- [ ] **Step 2: Add combo CSS to style.css**

In `src/style.css`, append at the end:
```css
#hud-combo {
  position: absolute;
  top: 80px;
  right: 16px;
  text-align: right;
  font-family: inherit;
}
#hud-combo-text {
  color: #ffcc00;
  text-shadow: 0 0 12px #ffcc00;
  font-size: 1.1em;
  letter-spacing: 2px;
  display: block;
}
#hud-combo-bar-wrap {
  width: 120px;
  height: 4px;
  background: #333;
  margin-top: 4px;
  border-radius: 2px;
  overflow: hidden;
  margin-left: auto;
}
#hud-combo-bar {
  height: 100%;
  background: #ffcc00;
  box-shadow: 0 0 6px #ffcc00;
  transition: width 0.05s linear;
}
@keyframes combo-pop {
  0%   { transform: scale(1.4); }
  100% { transform: scale(1.0); }
}
.combo-pop {
  animation: combo-pop 0.15s ease-out forwards;
}
```

- [ ] **Step 3: Update updateHud() to render combo**

In `src/hud.js`, inside `updateHud(gameState)`, after the drone-warn block, add combo rendering. Find:
```js
  const warn = document.getElementById('hud-drone-warn')
  if (warn) warn.style.display = gameState.droneProximity > 0.6 ? 'block' : 'none'
}
```

Replace with:
```js
  const warn = document.getElementById('hud-drone-warn')
  if (warn) warn.style.display = gameState.droneProximity > 0.6 ? 'block' : 'none'

  const comboEl = document.getElementById('hud-combo')
  const comboTextEl = document.getElementById('hud-combo-text')
  const comboBarEl = document.getElementById('hud-combo-bar')
  if (comboEl && gameState.combo !== undefined) {
    if (gameState.combo >= 2) {
      comboEl.style.display = 'block'
      comboTextEl.textContent = `×${gameState.combo} COMBO`
      const pct = Math.max(0, (1 - gameState.comboTimer / 2.0) * 100)
      comboBarEl.style.width = `${pct}%`
    } else {
      comboEl.style.display = 'none'
    }
  }
}
```

- [ ] **Step 4: Add combo-pop animation on combo increase**

To trigger the pop animation, `updateHud` needs to know when combo changed. Add a module-level variable to `hud.js` at the top (after the const declarations):
```js
let lastCombo = 1
```

Then inside the combo rendering block, after `comboTextEl.textContent = ...`:
```js
      if (gameState.combo !== lastCombo) {
        comboTextEl.classList.remove('combo-pop')
        void comboTextEl.offsetWidth  // force reflow to restart animation
        comboTextEl.classList.add('combo-pop')
        lastCombo = gameState.combo
      }
```

And reset `lastCombo` when combo is 1:
```js
    } else {
      comboEl.style.display = 'none'
      lastCombo = 1
    }
```

- [ ] **Step 5: Fix title screen BEST display to read localStorage**

In `src/hud.js`, inside `showScreen`, find the TITLE innerHTML string:
```js
        <h1>NEON RUNNER</h1>
        <p style="color:#aa88ff;margin-top:6px;letter-spacing:3px">CYBERPUNK ENDLESS RUNNER</p>
```

Add a BEST line immediately after the `<p>` tag (before `<div class="skin-row">`):
```js
    overlayEl.innerHTML = `
      <div class="screen">
        <h1>NEON RUNNER</h1>
        <p style="color:#aa88ff;margin-top:6px;letter-spacing:3px">CYBERPUNK ENDLESS RUNNER</p>
        <p class="hi-stat" style="margin-top:4px">BEST: ${parseInt(localStorage.getItem('neon-runner-highscore') || '0')}</p>
        <div class="skin-row">
```

- [ ] **Step 6: Add NEW BEST! highlight to game-over screen**

In `src/hud.js`, inside `showScreen('GAME_OVER')`, find:
```js
    const hi = Math.max(parseInt(localStorage.getItem('neon-runner-highscore') || '0'), gameState.score)
    localStorage.setItem('neon-runner-highscore', String(hi))
    overlayEl.innerHTML = `
      <div class="screen">
        <h2>CAPTURED</h2>
        <p class="stat">DISTANCE &nbsp; ${Math.floor(gameState.distance)}m</p>
        <p class="stat">SCORE &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${gameState.score}</p>
        <p class="hi-stat">BEST &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${hi}</p>
```

Replace with:
```js
    const prevHi = parseInt(localStorage.getItem('neon-runner-highscore') || '0')
    const hi = Math.max(prevHi, gameState.score)
    localStorage.setItem('neon-runner-highscore', String(hi))
    const isNewBest = gameState.score > prevHi && gameState.score > 0
    overlayEl.innerHTML = `
      <div class="screen">
        <h2>CAPTURED</h2>
        <p class="stat">DISTANCE &nbsp; ${Math.floor(gameState.distance)}m</p>
        <p class="stat">SCORE &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${gameState.score}</p>
        <p class="hi-stat" style="${isNewBest ? 'color:#ffcc00;text-shadow:0 0 12px #ffcc00' : ''}">
          ${isNewBest ? 'NEW BEST!' : 'BEST'} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${hi}
        </p>
```

- [ ] **Step 7: Verify HUD visuals**

```bash
npm run dev
```
- Collect 2+ shards quickly → `×2 COMBO` appears top-right, timer bar drains over 2s
- Collect more → `×3 COMBO` with pop animation
- Die → game-over shows NEW BEST! in gold if score beats previous
- Title screen shows BEST from localStorage

- [ ] **Step 8: Run tests**

```bash
npm test
```
Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add src/hud.js src/style.css
git commit -m "feat: combo HUD display with timer bar, NEW BEST highlight, title screen shows best"
```
