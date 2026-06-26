# Drone Redesign: Scan Beam Attacker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the drone proximity meter with an independent scan beam attacker that fires across the screen on its own timer, requiring the player to jump (LOW beam) or slide (HIGH beam) to dodge.

**Architecture:** Drone gets a phase-based state machine (IDLE→WARNING→BEAM→COOLDOWN) driven by an independent timer inside `drone.js`. Two beam types alternate; `update()` returns `{ beamHit, warningStarted, beamType }` so `main.js` handles HP loss, combo reset, and audio. All drone proximity code is deleted.

**Tech Stack:** Three.js r165, Vanilla JS ES modules, Vitest, Web Audio API

## Global Constraints

- No framework. ES modules only. No new npm packages.
- All game logic mutates `gameState` passed by reference. Modules never own state across restarts — `reset()` is called by main.js on restart.
- Tests import modules directly (Three.js works in Node via Vitest). No DOM mocking needed for pure functions.
- Run individual test file: `npx vitest run tests/<file>.test.js`
- Run all tests: `npm test`
- Dev server: `npm run dev` at `http://localhost:3000`

---

### Task 1: Add beam constants and pure functions with tests

**Files:**
- Modify: `src/constants.js`
- Modify: `src/drone.js` (add two new exports above existing code)
- Modify: `tests/drone.test.js` (replace old `calcProximityDelta` tests)

**Interfaces:**
- Produces:
  - `BEAM_LOW_Y: number` (0.5) exported from `src/constants.js`
  - `BEAM_HIGH_Y: number` (1.5) exported from `src/constants.js`
  - `pickBeamInterval(distance: number): number` exported from `src/drone.js`
  - `beamHitsPlayer(beamType: 'LOW'|'HIGH', playerYPos: number, playerAction: string): boolean` exported from `src/drone.js`

- [ ] **Step 1: Rewrite tests/drone.test.js with failing tests**

```js
import { describe, it, expect } from 'vitest'
import { pickBeamInterval, beamHitsPlayer } from '../src/drone.js'

describe('pickBeamInterval', () => {
  it('returns 10–15 when distance < 1000', () => {
    for (let i = 0; i < 30; i++) {
      const v = pickBeamInterval(500)
      expect(v).toBeGreaterThanOrEqual(10)
      expect(v).toBeLessThanOrEqual(15)
    }
  })

  it('returns 7–12 when distance is 1000–3000', () => {
    for (let i = 0; i < 30; i++) {
      const v = pickBeamInterval(2000)
      expect(v).toBeGreaterThanOrEqual(7)
      expect(v).toBeLessThanOrEqual(12)
    }
  })

  it('returns 5–9 when distance >= 3000', () => {
    for (let i = 0; i < 30; i++) {
      const v = pickBeamInterval(5000)
      expect(v).toBeGreaterThanOrEqual(5)
      expect(v).toBeLessThanOrEqual(9)
    }
  })
})

describe('beamHitsPlayer', () => {
  it('LOW beam hits player standing on ground', () => {
    expect(beamHitsPlayer('LOW', 0, 'RUNNING')).toBe(true)
  })

  it('LOW beam hits player sliding', () => {
    expect(beamHitsPlayer('LOW', 0, 'SLIDING')).toBe(true)
  })

  it('LOW beam misses player who has jumped above beam height', () => {
    expect(beamHitsPlayer('LOW', 0.6, 'JUMPING')).toBe(false)
  })

  it('HIGH beam hits standing player', () => {
    expect(beamHitsPlayer('HIGH', 0, 'RUNNING')).toBe(true)
  })

  it('HIGH beam hits jumping player (feet below beam)', () => {
    expect(beamHitsPlayer('HIGH', 0, 'JUMPING')).toBe(true)
  })

  it('HIGH beam misses sliding player', () => {
    expect(beamHitsPlayer('HIGH', 0, 'SLIDING')).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run tests/drone.test.js
```
Expected: FAIL — `pickBeamInterval is not a function` and `beamHitsPlayer is not a function`

- [ ] **Step 3: Add BEAM_LOW_Y and BEAM_HIGH_Y to src/constants.js**

After the `export const INVINCIBLE_DURATION = 0.8` line, add:
```js
export const BEAM_LOW_Y = 0.5
export const BEAM_HIGH_Y = 1.5
```

- [ ] **Step 4: Add pure functions to src/drone.js — insert after the `import * as THREE` line**

```js
import { BEAM_LOW_Y, BEAM_HIGH_Y } from './constants.js'

export function pickBeamInterval(distance) {
  let min, max
  if (distance < 1000)      { min = 10; max = 15 }
  else if (distance < 3000) { min = 7;  max = 12 }
  else                      { min = 5;  max = 9  }
  return min + Math.random() * (max - min)
}

export function beamHitsPlayer(beamType, playerYPos, playerAction) {
  if (beamType === 'LOW')  return playerYPos < BEAM_LOW_Y
  if (beamType === 'HIGH') return playerAction !== 'SLIDING'
  return false
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npx vitest run tests/drone.test.js
```
Expected: PASS — 9 tests, all green

- [ ] **Step 6: Run full test suite**

```bash
npm test
```
Expected: all tests pass (collision, combo, imports, drone)

- [ ] **Step 7: Commit**

```bash
git add src/constants.js src/drone.js tests/drone.test.js
git commit -m "feat: beam constants, pickBeamInterval, beamHitsPlayer with tests"
```

---

### Task 2: Rewrite drone.js — phase state machine + beam meshes

**Files:**
- Modify: `src/drone.js` — full rewrite of `initDrone`; remove `calcProximityDelta`

**Interfaces:**
- Consumes: `BEAM_LOW_Y`, `BEAM_HIGH_Y`, `pickBeamInterval`, `beamHitsPlayer` (all in same file)
- Produces: `initDrone(scene) → { update(delta, gameState): { beamHit: boolean, warningStarted: boolean, beamType: 'LOW'|'HIGH' }, reset(): void }`

Note: `calcProximityDelta` is removed in this task. Task 3 (main.js) must follow immediately to fix the broken import.

- [ ] **Step 1: Replace src/drone.js entirely**

```js
import * as THREE from 'three'
import { BEAM_LOW_Y, BEAM_HIGH_Y } from './constants.js'

export function pickBeamInterval(distance) {
  let min, max
  if (distance < 1000)      { min = 10; max = 15 }
  else if (distance < 3000) { min = 7;  max = 12 }
  else                      { min = 5;  max = 9  }
  return min + Math.random() * (max - min)
}

export function beamHitsPlayer(beamType, playerYPos, playerAction) {
  if (beamType === 'LOW')  return playerYPos < BEAM_LOW_Y
  if (beamType === 'HIGH') return playerAction !== 'SLIDING'
  return false
}

function buildDroneMesh() {
  const group = new THREE.Group()
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff0000, emissiveIntensity: 2, metalness: 0.9 })
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.8), bodyMat)
  group.add(body)
  ;[-0.7, 0.7].forEach(x => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.08), bodyMat)
    arm.position.set(x, 0, 0)
    group.add(arm)
    const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 8), bodyMat)
    rotor.position.set(x, 0.1, 0)
    rotor.name = 'rotor'
    group.add(rotor)
  })
  group.visible = false
  return group
}

function buildBeamMesh(color, y) {
  const mat = new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: 3,
    transparent: true, opacity: 0.9,
  })
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(40, 0.12, 0.3), mat)
  mesh.position.set(0, y, 0)
  mesh.visible = false
  return mesh
}

export function initDrone(scene) {
  const droneGroup = buildDroneMesh()
  scene.add(droneGroup)

  const lowBeam  = buildBeamMesh(0xff2200, BEAM_LOW_Y)
  const highBeam = buildBeamMesh(0x0066ff, BEAM_HIGH_Y)
  scene.add(lowBeam)
  scene.add(highBeam)

  const warnEl = document.createElement('div')
  warnEl.id = 'drone-beam-warn'
  warnEl.style.cssText = [
    'position:absolute', 'top:80px', 'left:50%', 'transform:translateX(-50%)',
    'padding:8px 28px', 'border-radius:4px', 'font-family:monospace',
    'font-size:22px', 'font-weight:bold', 'letter-spacing:3px',
    'display:none', 'text-align:center', 'color:#fff',
  ].join(';')
  document.getElementById('hud').appendChild(warnEl)

  // phase: 'IDLE' | 'WARNING' | 'BEAM' | 'COOLDOWN'
  let phase = 'IDLE'
  let phaseTimer = 0
  let attackTimer = 0
  let nextInterval = 12   // first beam at 12s
  let beamType = 'LOW'    // alternates each attack

  function startWarning() {
    phase = 'WARNING'
    phaseTimer = 1.5
    droneGroup.position.set(0, 5, 0)
    droneGroup.visible = true
    warnEl.style.display = 'block'
    if (beamType === 'LOW') {
      warnEl.textContent = '↑ JUMP'
      warnEl.style.background = 'rgba(200,20,0,0.85)'
      warnEl.style.boxShadow = '0 0 20px #ff2200'
    } else {
      warnEl.textContent = '↓ SLIDE'
      warnEl.style.background = 'rgba(0,60,200,0.85)'
      warnEl.style.boxShadow = '0 0 20px #0066ff'
    }
  }

  function update(delta, gameState) {
    if (gameState.status !== 'PLAYING') return { beamHit: false, warningStarted: false, beamType }

    droneGroup.children.filter(c => c.name === 'rotor').forEach(r => r.rotation.y += delta * 20)

    if (phase === 'IDLE') {
      attackTimer += delta
      if (attackTimer >= nextInterval) {
        attackTimer = 0
        startWarning()
        return { beamHit: false, warningStarted: true, beamType }
      }
      return { beamHit: false, warningStarted: false, beamType }
    }

    phaseTimer -= delta

    if (phase === 'WARNING') {
      if (phaseTimer <= 0) {
        phase = 'BEAM'
        phaseTimer = 0.7
        warnEl.style.display = 'none'
        const beam = beamType === 'LOW' ? lowBeam : highBeam
        beam.visible = true
        beam.material.opacity = 0.9
      }
      return { beamHit: false, warningStarted: false, beamType }
    }

    if (phase === 'BEAM') {
      const beam = beamType === 'LOW' ? lowBeam : highBeam
      beam.material.emissiveIntensity = 3 + Math.sin(phaseTimer * 40) * 1.5

      const beamHit = gameState.player.invincibleTimer <= 0
        && beamHitsPlayer(beamType, gameState.player.yPos, gameState.player.action)

      if (phaseTimer <= 0) {
        phase = 'COOLDOWN'
        phaseTimer = 0.5
      }
      return { beamHit, warningStarted: false, beamType }
    }

    if (phase === 'COOLDOWN') {
      const beam = beamType === 'LOW' ? lowBeam : highBeam
      beam.material.opacity = Math.max(0, (phaseTimer / 0.5) * 0.9)
      if (phaseTimer <= 0) {
        beam.visible = false
        droneGroup.visible = false
        phase = 'IDLE'
        beamType = beamType === 'LOW' ? 'HIGH' : 'LOW'
        nextInterval = pickBeamInterval(gameState.distance)
      }
    }

    return { beamHit: false, warningStarted: false, beamType }
  }

  function reset() {
    phase = 'IDLE'
    phaseTimer = 0
    attackTimer = 0
    nextInterval = 12
    beamType = 'LOW'
    droneGroup.visible = false
    lowBeam.visible = false
    highBeam.visible = false
    warnEl.style.display = 'none'
  }

  return { update, reset }
}
```

- [ ] **Step 2: Run tests**

```bash
npm test
```
Expected: all tests pass — drone.test.js still passes because `pickBeamInterval` and `beamHitsPlayer` are still exported.

- [ ] **Step 3: Commit**

```bash
git add src/drone.js
git commit -m "feat: drone rewrite — scan beam phase machine, beam meshes, warning UI"
```

---

### Task 3: Wire drone into main.js

**Files:**
- Modify: `src/main.js`

**Interfaces:**
- Consumes:
  - `initDrone(scene): { update, reset }` from `src/drone.js` (no more `calcProximityDelta`)
  - `droneApi.update(delta, gameState): { beamHit: boolean, warningStarted: boolean, beamType: 'LOW'|'HIGH' }`
  - `INVINCIBLE_DURATION` already imported from `src/constants.js`

- [ ] **Step 1: Update the import from drone.js**

Old line 10:
```js
import { calcProximityDelta, initDrone } from './drone.js'
```
New:
```js
import { initDrone } from './drone.js'
```

- [ ] **Step 2: Remove droneProximity from makeGameState**

Old:
```js
    powerUp: null,
    droneProximity: 0,
    combo: 0,
```
New:
```js
    powerUp: null,
    combo: 0,
```

- [ ] **Step 3: Remove captureTriggered variable declaration**

Remove this line (line 68):
```js
let captureTriggered = false
```

- [ ] **Step 4: Remove captureTriggered = false from the restart handler**

Old:
```js
  droneApi.reset()
  particleApi.reset()
  captureTriggered = false
```
New:
```js
  droneApi.reset()
  particleApi.reset()
```

- [ ] **Step 5: Replace the drone update calls and remove proximity logic**

Find this block (lines 183–203):
```js
    const evaded = false  // passive decay + overdrive handles drone tension; per-frame signal overwhelmed delta
    const proxDelta = calcProximityDelta({
      hitObstacle,
      evaded,
      overdrive: gameState.powerUp?.type === 'OVERDRIVE',
    }, delta)
    gameState.droneProximity = Math.max(0, Math.min(1, gameState.droneProximity + proxDelta))
    try { audioApi.play('drone_warn', gameState.droneProximity) } catch(e) {}

    particleApi.update(delta, gameState, camera)
    droneApi.update(delta, gameState)
    droneApi.updateCapture(delta)

    if (gameState.droneProximity >= 1 && !captureTriggered) {
      captureTriggered = true
      gameState.hp = 0
      droneApi.triggerCapture(camera, gameState, () => {
        gameState.status = 'GAME_OVER'
        showScreen('GAME_OVER', gameState)
      })
    }
```

Replace with:
```js
    particleApi.update(delta, gameState, camera)
    const { beamHit, warningStarted, beamType } = droneApi.update(delta, gameState)
    if (warningStarted) {
      try { audioApi.play('beam_warn', beamType) } catch(e) {}
    }
    if (beamHit) {
      particleApi.burstHit(playerApi.group.position.clone())
      try { audioApi.play('beam_hit') } catch(e) {}
      gameState.hp -= 1
      gameState.player.invincibleTimer = INVINCIBLE_DURATION
      gameState.timeScale = 0.25
      gameState.slowTimer = 0.2
      gameState.cameraShake = { intensity: 0.15, duration: 0.3 }
      gameState.combo = 0
      gameState.comboTimer = 0
      if (gameState.hp <= 0) {
        gameState.status = 'GAME_OVER'
        showScreen('GAME_OVER', gameState)
      }
    }
```

- [ ] **Step 6: Run tests**

```bash
npm test
```
Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/main.js
git commit -m "feat: wire scan beam into main loop, remove proximity system"
```

---

### Task 4: Clean up hud.js, audio.js, and style.css

**Files:**
- Modify: `src/hud.js`
- Modify: `src/audio.js`
- Modify: `src/style.css`

**Interfaces:**
- Produces: `audioApi.play('beam_warn', beamType)` and `audioApi.play('beam_hit')` — must be in SOUNDS or the `play()` call in main.js silently fails (it uses optional chaining `SOUNDS[event]?.()`)

- [ ] **Step 1: Remove hud-drone-warn from hud.js initHud**

In `initHud()`, remove this line from the innerHTML template:
```js
    <div id="hud-drone-warn">⚠ DRONE CLOSING IN ⚠</div>
```

- [ ] **Step 2: Remove droneProximity reference from hud.js updateHud**

Find and remove these two lines (around line 45–46):
```js
  const warn = document.getElementById('hud-drone-warn')
  if (warn) warn.style.display = gameState.droneProximity > 0.6 ? 'block' : 'none'
```

- [ ] **Step 3: Replace drone_warn with beam sounds in audio.js**

In the `SOUNDS` object, find:
```js
  drone_warn(proximity) {
    if (proximity < 0.5) return
    const t = getCtx().currentTime
    const freq = 200 + proximity * 400
    beep(freq, 'square', 0.05, proximity * 0.15, t)
  },
```

Replace with:
```js
  beam_warn(type) {
    const t = getCtx().currentTime
    const freq = type === 'LOW' ? 440 : 660
    beep(freq, 'square', 0.08, 0.2, t)
    beep(freq * 1.5, 'square', 0.05, 0.15, t + 0.12)
  },
  beam_hit() {
    const t = getCtx().currentTime
    beep(300, 'square', 0.12, 0.35, t)
    beep(150, 'sawtooth', 0.15, 0.25, t + 0.04)
  },
```

- [ ] **Step 4: Remove drone-glow and hud-drone-warn CSS from style.css**

Remove the `.drone-glow` rule:
```css
.drone-glow {
  position: absolute; inset: 0;
  pointer-events: none;
}
```

Remove the `#hud-drone-warn` rule:
```css
#hud-drone-warn {
  position:absolute; bottom:80px; left:50%; transform:translateX(-50%);
  font-size:16px; font-weight:bold; color:#ff0044; text-shadow:0 0 10px #ff0044;
  display:none; letter-spacing:2px;
}
```

- [ ] **Step 5: Run all tests**

```bash
npm test
```
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/hud.js src/audio.js src/style.css
git commit -m "feat: remove proximity HUD/audio, add beam_warn and beam_hit sounds"
```
