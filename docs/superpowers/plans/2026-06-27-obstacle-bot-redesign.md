# Obstacle & Bot Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign all 5 obstacle types with 2–3 visual variants each, add 2-lane obstacles (WIDE_WALL, WIDE_HURDLE), and add SPINNER_BOT + CHARGER_BOT with novel TIMING-based avoidance.

**Architecture:** Replace flat `OBSTACLE_FACTORIES` with `OBSTACLE_VARIANTS` (arrays of factories per mechanic type). Pool pre-builds one slot per variant, spawn picks mechanic type first then searches for a free matching-mechanic slot. SPINNER_BOT exports `calcSpinnerAABB(spinAngle)` and CHARGER_BOT exports `tickChargerBot(state, delta, speed, objZ)` as pure functions for testing.

**Tech Stack:** Three.js r165, Vite, Vitest, vanilla JS ES modules.

## Global Constraints

- All geometry procedural — no external assets
- `userData.type` stays the mechanic string (e.g. `'HOLOGRAM_SIGN'`) across all variants
- `userData.hazardAABB` uses local-space offsets applied as `pos.x + hz.minX` in getAABB()
- SPINNER_BOT / CHARGER_BOT spawn only when `gameState.distance >= 1000`
- 2-lane obstacles spawn only when `gameState.distance >= 600`, never consecutive
- `LANES = [-2.5, 0, 2.5]`
- Pool pre-builds all meshes at init — no mesh rebuild on spawn
- `emissiveMat(color, emissive, intensity=1.5)` helper stays in obstacle-types.js

---

### Task 1: Architecture — OBSTACLE_VARIANTS + updated obstacles.js

**Files:**
- Modify: `src/obstacle-types.js` — change export from `OBSTACLE_FACTORIES` flat object to `OBSTACLE_VARIANTS` arrays + stub new types + export pure functions
- Modify: `src/obstacles.js` — new pool build, new `spawnOne(gameState)`, consume `calcSpinnerAABB` / `tickChargerBot`
- Create: `tests/obstacle-variants.test.js`

**Interfaces:**
- Produces: `OBSTACLE_VARIANTS: Record<string, Array<() => THREE.Group>>`
- Produces: `calcSpinnerAABB(spinAngle: number): HazardAABB`
- Produces: `tickChargerBot(state, delta, speed, objZ): { newState, dz, vibX }`
- Produces: pool entries `{ obj: THREE.Group, active: boolean, mechanic: string }`

- [ ] **Step 1: Write failing test**

```js
// tests/obstacle-variants.test.js
import { describe, it, expect } from 'vitest'
import { OBSTACLE_VARIANTS, calcSpinnerAABB, tickChargerBot } from '../src/obstacle-types.js'

describe('OBSTACLE_VARIANTS', () => {
  it('exports an object of non-empty arrays', () => {
    expect(typeof OBSTACLE_VARIANTS).toBe('object')
    for (const [key, arr] of Object.entries(OBSTACLE_VARIANTS)) {
      expect(Array.isArray(arr), `${key} should be array`).toBe(true)
      expect(arr.length, `${key} needs variants`).toBeGreaterThan(0)
    }
  })

  it('each factory sets required userData', () => {
    for (const [mechanic, variants] of Object.entries(OBSTACLE_VARIANTS)) {
      for (const factory of variants) {
        const group = factory()
        expect(group.userData.type, `${mechanic} type`).toBeTruthy()
        expect(group.userData.avoidWith, `${mechanic} avoidWith`).toBeTruthy()
        const hz = group.userData.hazardAABB
        expect(hz, `${mechanic} hazardAABB`).toBeTruthy()
        for (const k of ['minX','maxX','minY','maxY','minZ','maxZ']) {
          expect(typeof hz[k], `${mechanic} hz.${k}`).toBe('number')
        }
      }
    }
  })
})

describe('calcSpinnerAABB', () => {
  it('returns safe AABB when arm points in Z direction (cosA near 0)', () => {
    // rotation.y = π/2: arm points toward player (+Z), cos(π/2)=0, thin X profile → safe
    const aabb = calcSpinnerAABB(Math.PI / 2)
    expect(aabb.minY).toBeGreaterThan(90)
  })

  it('returns active AABB when arm spans across lanes (cosA near 1)', () => {
    // rotation.y = 0: arm extends in ±X direction, cos(0)=1, spans lane → danger
    const aabb = calcSpinnerAABB(0)
    expect(aabb.minY).toBeLessThan(2)
    expect(aabb.maxY).toBeLessThan(2)
  })
})

describe('tickChargerBot', () => {
  const baseState = { chargeState: 'APPROACH', windupTimer: 0, chargeTimer: 0, time: 0 }

  it('moves normally during APPROACH', () => {
    const { dz, vibX } = tickChargerBot(baseState, 0.016, 12, -30)
    expect(dz).toBeCloseTo(0.016 * 12)
    expect(vibX).toBe(0)
  })

  it('triggers WINDUP when objZ > -20', () => {
    const { newState } = tickChargerBot(baseState, 0.016, 12, -19)
    expect(newState.chargeState).toBe('WINDUP')
  })

  it('freezes movement during WINDUP', () => {
    const windup = { ...baseState, chargeState: 'WINDUP' }
    const { dz } = tickChargerBot(windup, 0.016, 12, -10)
    expect(dz).toBe(0)
  })

  it('transitions to CHARGE after 0.5s WINDUP', () => {
    const windup = { ...baseState, chargeState: 'WINDUP', windupTimer: 0.49 }
    const { newState } = tickChargerBot(windup, 0.02, 12, -10)
    expect(newState.chargeState).toBe('CHARGE')
  })

  it('moves at 5x speed during CHARGE', () => {
    const charge = { ...baseState, chargeState: 'CHARGE' }
    const { dz } = tickChargerBot(charge, 0.016, 12, -5)
    expect(dz).toBeCloseTo(0.016 * 12 * 5)
  })
})
```

- [ ] **Step 2: Run test — confirm FAIL**

```bash
npx vitest run tests/obstacle-variants.test.js
```
Expected: FAIL — `OBSTACLE_VARIANTS` not exported

- [ ] **Step 3: Rewrite obstacle-types.js with OBSTACLE_VARIANTS structure**

Replace the entire file. Keep all 5 existing factory bodies, rename them to `hologramSignA`, `neonPipeA`, etc. Stub new types as copies of existing (real implementations in Tasks 2–6).

```js
import * as THREE from 'three'

function emissiveMat(color, emissive, intensity = 1.5) {
  return new THREE.MeshStandardMaterial({
    color, emissive, emissiveIntensity: intensity, roughness: 0.4, metalness: 0.5,
  })
}

// ─── HOLOGRAM_SIGN ────────────────────────────────────────────────────────────
function hologramSignA() {
  const group = new THREE.Group()
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 2.15, 0.1),
    emissiveMat(0x003366, 0x0066ff)
  )
  panel.position.y = 1.075
  panel.name = 'signPanel'
  group.add(panel)
  const frameMat = emissiveMat(0x002244, 0x00aaff, 2.5)
  ;[2.15, 0].forEach(y => {
    const e = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.05, 0.05), frameMat)
    e.position.set(0, y, 0.06)
    group.add(e)
  })
  ;[-1.2, 1.2].forEach(x => {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.2, 0.05), frameMat)
    e.position.set(x, 1.075, 0.06)
    group.add(e)
  })
  const textMat = emissiveMat(0x002233, 0x00ccff, 1.2)
  ;[1.7, 1.4, 1.1].forEach(y => {
    const line = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 0.05), textMat)
    line.position.set(0, y, 0.08)
    group.add(line)
  })
  group.userData.type = 'HOLOGRAM_SIGN'
  group.userData.avoidWith = 'JUMP'
  group.userData.time = 0
  group.userData.glitchTimer = 1.2 + Math.random() * 0.8
  group.userData.hazardAABB = { minX: -0.9, maxX: 0.9, minY: 0, maxY: 1.9, minZ: -0.15, maxZ: 0.15 }
  return group
}

// ─── NEON_PIPE ────────────────────────────────────────────────────────────────
function neonPipeA() {
  const group = new THREE.Group()
  const geo = new THREE.CylinderGeometry(0.15, 0.15, 2.6, 8)
  geo.rotateZ(Math.PI / 2)
  const pipe = new THREE.Mesh(geo, emissiveMat(0x004444, 0x00ffff))
  pipe.position.y = 1.2
  pipe.name = 'pipe'
  group.add(pipe)
  const capMat = emissiveMat(0x006666, 0x00ffff, 3)
  ;[-1.3, 1.3].forEach(x => {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 12), capMat)
    cap.rotation.z = Math.PI / 2
    cap.position.set(x, 1.2, 0)
    group.add(cap)
  })
  const bracketMat = emissiveMat(0x003333, 0x006666, 1)
  ;[-0.8, 0.8].forEach(x => {
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.06), bracketMat)
    bracket.position.set(x, 0.6, 0)
    group.add(bracket)
  })
  group.userData.type = 'NEON_PIPE'
  group.userData.avoidWith = 'SLIDE'
  group.userData.time = 0
  group.userData.hazardAABB = { minX: -1.3, maxX: 1.3, minY: 0.95, maxY: 1.45, minZ: -0.15, maxZ: 0.15 }
  return group
}

// ─── GAP ──────────────────────────────────────────────────────────────────────
function gapA() {
  const group = new THREE.Group()
  const geo = new THREE.PlaneGeometry(2.4, 3)
  geo.rotateX(-Math.PI / 2)
  const floor = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x000000 }))
  floor.position.y = -0.05
  group.add(floor)
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff3300, emissiveIntensity: 4 })
  const edgeH = new THREE.BoxGeometry(2.4, 0.06, 0.06)
  const edgeV = new THREE.BoxGeometry(0.06, 0.06, 3)
  ;[-1.5, 1.5].forEach((z, i) => {
    const e = new THREE.Mesh(edgeH, edgeMat)
    e.position.set(0, 0, z)
    if (i === 0) e.name = 'gapEdge'
    group.add(e)
  })
  ;[-1.2, 1.2].forEach(x => {
    const e = new THREE.Mesh(edgeV, edgeMat)
    e.position.set(x, 0, 0)
    group.add(e)
  })
  const crossMat = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff0000, emissiveIntensity: 2 })
  const diagGeo = new THREE.BoxGeometry(3.6, 0.04, 0.04)
  const cross1 = new THREE.Mesh(diagGeo, crossMat); cross1.position.y = 0.02; cross1.rotation.y = Math.PI / 4
  const cross2 = new THREE.Mesh(diagGeo, crossMat); cross2.position.y = 0.02; cross2.rotation.y = -Math.PI / 4
  group.add(cross1, cross2)
  group.userData.type = 'GAP'
  group.userData.avoidWith = 'JUMP'
  group.userData.time = 0
  group.userData.hazardAABB = { minX: -1.2, maxX: 1.2, minY: -10, maxY: 0.05, minZ: -1.5, maxZ: 1.5 }
  return group
}

// ─── LASER_GATE ───────────────────────────────────────────────────────────────
function laserGateA() {
  const group = new THREE.Group()
  ;[-1.1, 1.1].forEach(x => {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 0.14), emissiveMat(0x440000, 0xff0000, 2))
    base.position.set(x, 0.15, 0)
    const mid = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.8, 0.08), emissiveMat(0x440000, 0xff0000, 2))
    mid.position.set(x, 1.05, 0)
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 0.14), emissiveMat(0x440000, 0xff0000, 2))
    top.position.set(x, 1.95, 0)
    group.add(base, mid, top)
  })
  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.08), emissiveMat(0x440000, 0xff0000, 2))
  crossbar.position.y = 2.1
  group.add(crossbar)
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.06), emissiveMat(0x440000, 0xff0000, 3))
  beam.position.y = 1.2
  beam.name = 'beam'
  group.add(beam)
  const beam2 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.03, 0.03), emissiveMat(0x220000, 0xff4400, 2))
  beam2.position.y = 1.1
  beam2.name = 'beam2'
  group.add(beam2)
  group.userData.type = 'LASER_GATE'
  group.userData.avoidWith = 'SLIDE'
  group.userData.blinkTimer = 0
  group.userData.active = true
  group.userData.hazardAABB = { minX: -1.1, maxX: 1.1, minY: 1.07, maxY: 1.23, minZ: -0.03, maxZ: 0.03 }
  return group
}

// ─── PATROL_BOT ───────────────────────────────────────────────────────────────
function patrolBotA() {
  const group = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.4), emissiveMat(0x222200, 0xffcc00, 1.5))
  body.position.y = 0.5
  body.name = 'botBody'
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.3), emissiveMat(0x333300, 0xffcc00, 2))
  head.position.y = 1.0
  head.name = 'botHead'
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x440000, emissive: 0xff2200, emissiveIntensity: 3 })
  const eyeGeo = new THREE.SphereGeometry(0.05, 6, 6)
  const lEye = new THREE.Mesh(eyeGeo, eyeMat); lEye.position.set(-0.07, 1.02, 0.16)
  const rEye = new THREE.Mesh(eyeGeo, eyeMat); rEye.position.set(0.07, 1.02, 0.16)
  const antennaShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), emissiveMat(0x222200, 0xffcc00, 2))
  antennaShaft.position.set(0, 1.4, 0)
  const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), emissiveMat(0x333300, 0xffff00, 3))
  antennaTip.position.set(0, 1.58, 0)
  group.add(body, head, lEye, rEye, antennaShaft, antennaTip)
  group.userData.type = 'PATROL_BOT'
  group.userData.avoidWith = 'LANE'
  group.userData.patrolDir = 1
  group.userData.patrolSpeed = 2.5
  group.userData.time = 0
  group.userData.hazardAABB = { minX: -0.25, maxX: 0.25, minY: 0, maxY: 1.35, minZ: -0.2, maxZ: 0.2 }
  return group
}

// ─── STUBS (replaced in Tasks 2–6) ───────────────────────────────────────────
function hologramSignB() { return hologramSignA() }
function hologramSignC() { return hologramSignA() }
function neonPipeB() { return neonPipeA() }
function neonPipeC() { return neonPipeA() }
function gapB() { return gapA() }
function laserGateB() { return laserGateA() }
function patrolBotB() { return patrolBotA() }
function patrolBotC() { return patrolBotA() }
function wideWallA() { return hologramSignA() }
function wideWallB() { return hologramSignA() }
function wideHurdleA() { return neonPipeA() }
function wideHurdleB() { return neonPipeA() }
function spinnerBotA() { return patrolBotA() }
function chargerBotA() { return patrolBotA() }

export const OBSTACLE_VARIANTS = {
  HOLOGRAM_SIGN: [hologramSignA, hologramSignB, hologramSignC],
  NEON_PIPE:     [neonPipeA, neonPipeB, neonPipeC],
  GAP:           [gapA, gapB],
  LASER_GATE:    [laserGateA, laserGateB],
  PATROL_BOT:    [patrolBotA, patrolBotB, patrolBotC],
  WIDE_WALL:     [wideWallA, wideWallB],
  WIDE_HURDLE:   [wideHurdleA, wideHurdleB],
  SPINNER_BOT:   [spinnerBotA],
  CHARGER_BOT:   [chargerBotA],
}

export function calcSpinnerAABB(spinAngle) {
  // Arm rotates on Y axis, extends along X. cosA = X span factor.
  // Safe when arm points in Z direction (toward/away from player) — small X profile.
  const cosA = Math.cos(spinAngle)
  if (Math.abs(cosA) < 0.3) {
    return { minX: -0.65, maxX: 0.65, minY: 99, maxY: 100, minZ: -0.15, maxZ: 0.15 }
  }
  return { minX: -0.65, maxX: 0.65, minY: 0.65, maxY: 1.05, minZ: -0.15, maxZ: 0.15 }
}

export function tickChargerBot(state, delta, speed, objZ) {
  const s = { ...state, time: state.time + delta }
  if (s.chargeState === 'APPROACH') {
    if (objZ > -20) s.chargeState = 'WINDUP'
    return { newState: s, dz: speed * delta, vibX: 0 }
  }
  if (s.chargeState === 'WINDUP') {
    s.windupTimer += delta
    const vibX = Math.sin(s.time * 30) * 0.03
    if (s.windupTimer >= 0.5) { s.chargeState = 'CHARGE'; s.chargeTimer = 0 }
    return { newState: s, dz: 0, vibX }
  }
  if (s.chargeState === 'CHARGE') {
    s.chargeTimer += delta
    return { newState: s, dz: speed * 5 * delta, vibX: 0 }
  }
  return { newState: s, dz: speed * delta, vibX: 0 }
}
```

- [ ] **Step 4: Rewrite obstacles.js to use OBSTACLE_VARIANTS**

Replace the entire file:

```js
import * as THREE from 'three'
import { LANES } from './constants.js'
import { OBSTACLE_VARIANTS, calcSpinnerAABB, tickChargerBot } from './obstacle-types.js'

const POOL_SIZE = 24
const SPAWN_Z = -55
const RECYCLE_Z = 12
const BASE_INTERVAL = 2.2
const MIN_INTERVAL = 0.6

export function initObstacles(scene) {
  const allEntries = []
  for (const [mechanic, variants] of Object.entries(OBSTACLE_VARIANTS)) {
    for (const factory of variants) {
      allEntries.push({ mechanic, factory })
    }
  }

  const pool = []
  for (let i = 0; i < POOL_SIZE; i++) {
    const { mechanic, factory } = allEntries[i % allEntries.length]
    const obj = factory()
    obj.visible = false
    scene.add(obj)
    pool.push({ obj, active: false, mechanic })
  }

  let spawnTimer = 1.0
  let lastLane = -1
  let lastSpawnWasWide = false
  let recentChargerCount = 0
  const box3 = new THREE.Box3()

  function getActive() {
    return pool.filter(p => p.active).map(p => ({
      mesh: p.obj,
      type: p.obj.userData.type,
      avoidWith: p.obj.userData.avoidWith,
      getAABB() {
        const hz = p.obj.userData.hazardAABB
        const pos = p.obj.position
        box3.min.set(pos.x + hz.minX, hz.minY, pos.z + hz.minZ)
        box3.max.set(pos.x + hz.maxX, hz.maxY, pos.z + hz.maxZ)
        return box3
      },
    }))
  }

  function spawnOne(gameState) {
    const dist = gameState.distance
    let mechanic

    const wideOK = dist >= 600 && !lastSpawnWasWide
    if (wideOK && Math.random() < 0.15) {
      mechanic = Math.random() < 0.5 ? 'WIDE_WALL' : 'WIDE_HURDLE'
      lastSpawnWasWide = true
    } else {
      lastSpawnWasWide = false
      const available = Object.keys(OBSTACLE_VARIANTS).filter(t =>
        t !== 'WIDE_WALL' && t !== 'WIDE_HURDLE' &&
        (t !== 'SPINNER_BOT' || dist >= 1000) &&
        (t !== 'CHARGER_BOT' || dist >= 1000) &&
        (t !== 'CHARGER_BOT' || recentChargerCount <= 0)
      )
      mechanic = available[Math.floor(Math.random() * available.length)]
    }

    let entry = pool.find(p => !p.active && p.mechanic === mechanic)
             ?? pool.find(p => !p.active)
    if (!entry) return

    const isWide = mechanic === 'WIDE_WALL' || mechanic === 'WIDE_HURDLE'
    if (isWide) {
      const pair = Math.random() < 0.5 ? [0, 1] : [1, 2]
      const x = (LANES[pair[0]] + LANES[pair[1]]) / 2
      entry.obj.position.set(x, 0, SPAWN_Z)
    } else {
      let lane
      do { lane = Math.floor(Math.random() * 3) } while (lane === lastLane && Math.random() > 0.3)
      lastLane = lane
      entry.obj.position.set(LANES[lane], 0, SPAWN_Z)
    }

    entry.obj.userData.baseX = entry.obj.position.x

    const type = entry.obj.userData.type
    if (type === 'PATROL_BOT') {
      entry.obj.userData.patrolDir = Math.random() > 0.5 ? 1 : -1
      entry.obj.userData.time = 0
    }
    if (type === 'LASER_GATE') entry.obj.userData.blinkTimer = 0
    if (type === 'HOLOGRAM_SIGN') {
      entry.obj.userData.time = 0
      entry.obj.userData.glitchTimer = 1.2 + Math.random() * 0.8
    }
    if (type === 'NEON_PIPE') entry.obj.userData.time = 0
    if (type === 'GAP') entry.obj.userData.time = 0
    if (type === 'SPINNER_BOT') {
      entry.obj.userData.spinAngle = 0
      entry.obj.userData.spinSpeed = 1.5 + gameState.distance * 0.0003
      entry.obj.userData.time = 0
      entry.obj.userData.hazardAABB = calcSpinnerAABB(0)
    }
    if (type === 'CHARGER_BOT') {
      entry.obj.userData.chargeState = 'APPROACH'
      entry.obj.userData.windupTimer = 0
      entry.obj.userData.chargeTimer = 0
      entry.obj.userData.time = 0
      recentChargerCount = 3
    }
    if (type === 'WIDE_WALL' || type === 'WIDE_HURDLE') {
      entry.obj.userData.time = 0
    }

    entry.obj.visible = true
    entry.active = true
  }

  function update(delta, gameState) {
    if (gameState.status !== 'PLAYING') return
    const speed = gameState.speed

    const interval = Math.max(MIN_INTERVAL, BASE_INTERVAL - gameState.distance * 0.0003)
    spawnTimer -= delta
    if (spawnTimer <= 0) {
      if (recentChargerCount > 0) recentChargerCount--
      spawnOne(gameState)
      spawnTimer = interval + (Math.random() - 0.5) * 0.4
    }

    pool.forEach(entry => {
      if (!entry.active) return
      const obj = entry.obj
      const type = obj.userData.type

      if (type === 'CHARGER_BOT') {
        const result = tickChargerBot(
          { chargeState: obj.userData.chargeState, windupTimer: obj.userData.windupTimer,
            chargeTimer: obj.userData.chargeTimer, time: obj.userData.time },
          delta, speed, obj.position.z
        )
        obj.userData.chargeState = result.newState.chargeState
        obj.userData.windupTimer = result.newState.windupTimer
        obj.userData.chargeTimer = result.newState.chargeTimer
        obj.userData.time = result.newState.time
        obj.position.z += result.dz
        obj.position.x = obj.userData.baseX + result.vibX
        // visual flash during WINDUP
        const botBody = obj.getObjectByName('chargerBody')
        if (botBody) {
          botBody.material.emissiveIntensity = obj.userData.chargeState === 'WINDUP'
            ? 2 + Math.sin(obj.userData.time * 20) * 1.5
            : 1.5
        }
        // show/hide charge warning HUD
        const warnEl = document.getElementById('charge-warn')
        if (warnEl) warnEl.style.display = obj.userData.chargeState === 'WINDUP' ? 'block' : 'none'
      } else {
        obj.position.z += speed * delta
      }

      if (type === 'LASER_GATE') {
        obj.userData.blinkTimer += delta
        const beam = obj.getObjectByName('beam')
        const beam2 = obj.getObjectByName('beam2')
        if (beam) beam.visible = Math.sin(obj.userData.blinkTimer * 6) > 0
        if (beam2) beam2.visible = beam ? beam.visible : false
      }

      if (type === 'HOLOGRAM_SIGN') {
        obj.userData.time += delta
        obj.userData.glitchTimer -= delta
        const panel = obj.getObjectByName('signPanel')
        if (panel) {
          if (obj.userData.glitchTimer <= 0) {
            panel.material.emissiveIntensity = 0.05
            obj.userData.glitchTimer = 1.2 + Math.random() * 0.8
          } else {
            panel.material.emissiveIntensity = 1.5 + 0.4 * Math.sin(obj.userData.time * 6)
          }
        }
      }

      if (type === 'PATROL_BOT') {
        obj.userData.time += delta
        obj.position.x += obj.userData.patrolDir * obj.userData.patrolSpeed * delta
        if (obj.position.x > LANES[2] + 1) obj.userData.patrolDir = -1
        if (obj.position.x < LANES[0] - 1) obj.userData.patrolDir = 1
        const botBody = obj.getObjectByName('botBody')
        const botHead = obj.getObjectByName('botHead')
        if (botBody) botBody.position.y = 0.5 + 0.08 * Math.sin(obj.userData.time * 5)
        if (botHead) botHead.position.y = (botBody ? botBody.position.y : 0.5) + 0.5
        obj.rotation.z = obj.userData.patrolDir * 0.06 * Math.sin(obj.userData.time * 5)
      }

      if (type === 'NEON_PIPE') {
        obj.userData.time += delta
        const pipe = obj.getObjectByName('pipe')
        if (pipe) pipe.material.emissiveIntensity = 1.5 + 0.8 * Math.sin(obj.userData.time * 4)
      }

      if (type === 'GAP') {
        obj.userData.time += delta
        const gapEdge = obj.getObjectByName('gapEdge')
        if (gapEdge) gapEdge.material.emissiveIntensity = 4 + 2 * Math.abs(Math.sin(obj.userData.time * 3))
      }

      if (type === 'SPINNER_BOT') {
        obj.userData.spinAngle += delta * obj.userData.spinSpeed
        const spinArm = obj.getObjectByName('spinArm')
        if (spinArm) spinArm.rotation.y = obj.userData.spinAngle
        obj.userData.hazardAABB = calcSpinnerAABB(obj.userData.spinAngle)
      }

      if (obj.position.z > RECYCLE_Z) {
        obj.visible = false
        entry.active = false
        if (type === 'CHARGER_BOT') {
          const warnEl = document.getElementById('charge-warn')
          if (warnEl) warnEl.style.display = 'none'
        }
      }
    })
  }

  function reset() {
    pool.forEach(entry => { entry.obj.visible = false; entry.active = false })
    spawnTimer = 1.0
    lastLane = -1
    lastSpawnWasWide = false
    recentChargerCount = 0
    const warnEl = document.getElementById('charge-warn')
    if (warnEl) warnEl.style.display = 'none'
  }

  return { update, getActive, reset }
}
```

- [ ] **Step 5: Run tests — confirm PASS**

```bash
npx vitest run tests/obstacle-variants.test.js
```
Expected: all PASS

- [ ] **Step 6: Run full test suite**

```bash
npm test
```
Expected: all PASS (stubs keep existing behavior)

- [ ] **Step 7: Start dev server and verify game runs**

```bash
npm run dev
```
Open http://localhost:3000 — game should start and play normally. Obstacle types still appear (stubs return existing meshes).

- [ ] **Step 8: Commit**

```bash
git add src/obstacle-types.js src/obstacles.js tests/obstacle-variants.test.js
git commit -m "refactor: OBSTACLE_VARIANTS structure, new pool/spawn, pure functions for SPINNER/CHARGER"
```

---

### Task 2: JUMP obstacle variants (HOLOGRAM_SIGN B+C, GAP B)

**Files:**
- Modify: `src/obstacle-types.js` — replace `hologramSignB`, `hologramSignC`, `gapB` stubs with real implementations

**Interfaces:**
- Consumes: `emissiveMat()`, `THREE.*`
- Produces: `hologramSignB`, `hologramSignC`, `gapB` — same `userData.type` and `hazardAABB` as A variants

- [ ] **Step 1: Implement hologramSignB — Billboard**

Replace the stub in obstacle-types.js:

```js
function hologramSignB() {
  const group = new THREE.Group()
  // Angled support pole
  const poleMat = emissiveMat(0x111122, 0x334466, 0.8)
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 2.3, 8), poleMat)
  pole.position.set(0.7, 1.15, 0)
  pole.rotation.z = 0.08
  group.add(pole)
  // Pole foot anchor
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.22), poleMat)
  foot.position.set(0.7, 0.03, 0)
  group.add(foot)
  // Panel
  const panel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.85, 0.08), emissiveMat(0x003366, 0x0066ff))
  panel.position.y = 1.1
  panel.name = 'signPanel'
  group.add(panel)
  // Diagonal stripe overlays
  const stripeMat = emissiveMat(0x000033, 0x002299, 0.7)
  ;[-0.4, 0.2, 0.8].forEach(offset => {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.09, 0.05), stripeMat)
    stripe.position.set(0, 0.4 + offset * 1.5, 0.07)
    stripe.rotation.z = 0.28
    group.add(stripe)
  })
  // Frame
  const frameMat = emissiveMat(0x002244, 0x00aaff, 2.5)
  ;[2.03, 0.17].forEach(y => {
    const e = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.05, 0.05), frameMat)
    e.position.set(0, y, 0.1)
    group.add(e)
  })
  // Warning beacon on top
  const beaconMat = emissiveMat(0x440000, 0xff4400, 3)
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), beaconMat)
  beacon.position.set(0, 2.15, 0)
  beacon.name = 'beacon'
  group.add(beacon)
  const beaconRing = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 12), emissiveMat(0x330000, 0xff2200, 2))
  beaconRing.position.set(0, 2.14, 0)
  group.add(beaconRing)
  group.userData.type = 'HOLOGRAM_SIGN'
  group.userData.avoidWith = 'JUMP'
  group.userData.time = 0
  group.userData.glitchTimer = 1.2 + Math.random() * 0.8
  group.userData.hazardAABB = { minX: -0.9, maxX: 0.9, minY: 0, maxY: 1.9, minZ: -0.15, maxZ: 0.15 }
  return group
}
```

- [ ] **Step 2: Implement hologramSignC — Double Panel**

```js
function hologramSignC() {
  const group = new THREE.Group()
  const panelMat = emissiveMat(0x003366, 0x0066ff)
  // Upper panel, slight outward angle
  const upper = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.85, 0.08), panelMat)
  upper.position.set(0, 1.6, 0)
  upper.rotation.y = 0.06
  upper.name = 'signPanel'
  group.add(upper)
  // Lower panel, opposite angle
  const lower = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.85, 0.08), panelMat)
  lower.position.set(0, 0.55, 0)
  lower.rotation.y = -0.06
  group.add(lower)
  // Neon band between panels
  const bandMat = emissiveMat(0x001133, 0x00ffff, 3)
  const band = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.14, 0.14), bandMat)
  band.position.set(0, 1.1, 0)
  group.add(band)
  // Side connector bars
  const connMat = emissiveMat(0x002244, 0x00aaff, 2)
  ;[-1.05, 1.05].forEach(x => {
    const conn = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.0, 0.06), connMat)
    conn.position.set(x, 1.08, 0)
    group.add(conn)
  })
  // Top and bottom frame lines
  ;[2.05, 0.1].forEach(y => {
    const f = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 0.05), connMat)
    f.position.set(0, y, 0.1)
    group.add(f)
  })
  group.userData.type = 'HOLOGRAM_SIGN'
  group.userData.avoidWith = 'JUMP'
  group.userData.time = 0
  group.userData.glitchTimer = 1.2 + Math.random() * 0.8
  group.userData.hazardAABB = { minX: -0.9, maxX: 0.9, minY: 0, maxY: 1.9, minZ: -0.15, maxZ: 0.15 }
  return group
}
```

- [ ] **Step 3: Implement gapB — Energy Chasm**

```js
function gapB() {
  const group = new THREE.Group()
  // Dark floor void
  const voidGeo = new THREE.PlaneGeometry(2.4, 3)
  voidGeo.rotateX(-Math.PI / 2)
  const voidFloor = new THREE.Mesh(voidGeo, new THREE.MeshBasicMaterial({ color: 0x000011 }))
  voidFloor.position.y = -0.05
  group.add(voidFloor)
  // Blue-white glow plane at bottom of chasm
  const glowGeo = new THREE.PlaneGeometry(2.2, 2.8)
  glowGeo.rotateX(-Math.PI / 2)
  const glowMat = new THREE.MeshStandardMaterial({ color: 0x001133, emissive: 0x0044ff, emissiveIntensity: 3, transparent: true, opacity: 0.6 })
  const glowFloor = new THREE.Mesh(glowGeo, glowMat)
  glowFloor.position.y = -0.04
  glowFloor.name = 'gapEdge'
  group.add(glowFloor)
  // Fog volume (semi-transparent box rising from gap)
  const fogMat = new THREE.MeshStandardMaterial({ color: 0x001133, emissive: 0x0022aa, emissiveIntensity: 0.5, transparent: true, opacity: 0.18 })
  const fog = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 2.8), fogMat)
  fog.position.y = 0.3
  group.add(fog)
  // Electric arc edges
  const arcMat = new THREE.MeshStandardMaterial({ color: 0x002255, emissive: 0x0088ff, emissiveIntensity: 4 })
  ;[-1.5, 1.5].forEach(z => {
    const arc = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.05, 0.05), arcMat)
    arc.position.set(0, 0, z)
    group.add(arc)
  })
  ;[-1.2, 1.2].forEach(x => {
    const arc = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 3), arcMat)
    arc.position.set(x, 0, 0)
    group.add(arc)
  })
  group.userData.type = 'GAP'
  group.userData.avoidWith = 'JUMP'
  group.userData.time = 0
  group.userData.hazardAABB = { minX: -1.2, maxX: 1.2, minY: -10, maxY: 0.05, minZ: -1.5, maxZ: 1.5 }
  return group
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```
Expected: all PASS

- [ ] **Step 5: Verify visually**

```bash
npm run dev
```
Play until all 3 HOLOGRAM_SIGN and 2 GAP variants appear. Each should look visually distinct, same collision behavior.

- [ ] **Step 6: Commit**

```bash
git add src/obstacle-types.js
git commit -m "feat: HOLOGRAM_SIGN B/C and GAP B visual variants"
```

---

### Task 3: SLIDE obstacle variants (NEON_PIPE B+C, LASER_GATE B)

**Files:**
- Modify: `src/obstacle-types.js` — replace `neonPipeB`, `neonPipeC`, `laserGateB` stubs

- [ ] **Step 1: Implement neonPipeB — Pipe Cluster**

```js
function neonPipeB() {
  const group = new THREE.Group()
  const pipeMat = emissiveMat(0x004444, 0x00ffff)
  // Three pipes at slightly different heights — lowest sets AABB
  const configs = [
    { y: 1.05, r: 0.1, len: 2.6 },  // lowest — sets collision floor
    { y: 1.25, r: 0.08, len: 2.3 },
    { y: 1.45, r: 0.06, len: 1.8 },
  ]
  configs.forEach(({ y, r, len }, i) => {
    const geo = new THREE.CylinderGeometry(r, r, len, 8)
    geo.rotateZ(Math.PI / 2)
    const pipe = new THREE.Mesh(geo, emissiveMat(0x004444, 0x00ffff, 1.5 - i * 0.3))
    pipe.position.y = y
    if (i === 0) pipe.name = 'pipe'
    group.add(pipe)
  })
  // Bundling clamps at 3 positions
  const clampMat = emissiveMat(0x003333, 0x006666, 1)
  ;[-0.7, 0, 0.7].forEach(x => {
    const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), clampMat)
    clamp.position.set(x, 1.2, 0)
    group.add(clamp)
  })
  group.userData.type = 'NEON_PIPE'
  group.userData.avoidWith = 'SLIDE'
  group.userData.time = 0
  group.userData.hazardAABB = { minX: -1.3, maxX: 1.3, minY: 0.95, maxY: 1.45, minZ: -0.15, maxZ: 0.15 }
  return group
}
```

- [ ] **Step 2: Implement neonPipeC — Valve Pipe**

```js
function neonPipeC() {
  const group = new THREE.Group()
  // Main pipe
  const pipeGeo = new THREE.CylinderGeometry(0.14, 0.14, 2.2, 8)
  pipeGeo.rotateZ(Math.PI / 2)
  const pipe = new THREE.Mesh(pipeGeo, emissiveMat(0x004444, 0x00ffff))
  pipe.position.y = 1.2
  pipe.name = 'pipe'
  group.add(pipe)
  // Valve wheels at each end
  const valveMat = emissiveMat(0x336666, 0x00cccc, 2)
  ;[-1.1, 1.1].forEach(x => {
    // Wheel rim
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 12), valveMat)
    rim.rotation.y = Math.PI / 2
    rim.position.set(x, 1.2, 0)
    group.add(rim)
    // Wheel spokes (3)
    ;[0, Math.PI / 3 * 2, Math.PI / 3 * 4].forEach(angle => {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.44, 0.04), valveMat)
      spoke.position.set(x, 1.2, 0)
      spoke.rotation.x = angle
      group.add(spoke)
    })
    // Flange
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 10), valveMat)
    flange.rotation.z = Math.PI / 2
    flange.position.set(x, 1.2, 0)
    group.add(flange)
  })
  // Pressure gauge (center top)
  const gaugeMat = emissiveMat(0x333300, 0xffcc00, 2)
  const gaugeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 10), gaugeMat)
  gaugeBody.position.set(0, 1.36, 0)
  const gaugeNeedle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.02), emissiveMat(0x440000, 0xff2200, 3))
  gaugeNeedle.position.set(0, 1.41, 0)
  gaugeNeedle.rotation.z = 0.4
  group.add(gaugeBody, gaugeNeedle)
  // Pipe segments — weld rings
  const weldMat = emissiveMat(0x006666, 0x00ffff, 1)
  ;[-0.55, 0, 0.55].forEach(x => {
    const weld = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 10), weldMat)
    weld.rotation.z = Math.PI / 2
    weld.position.set(x, 1.2, 0)
    group.add(weld)
  })
  group.userData.type = 'NEON_PIPE'
  group.userData.avoidWith = 'SLIDE'
  group.userData.time = 0
  group.userData.hazardAABB = { minX: -1.3, maxX: 1.3, minY: 0.95, maxY: 1.45, minZ: -0.15, maxZ: 0.15 }
  return group
}
```

- [ ] **Step 3: Implement laserGateB — Arch Gate**

```js
function laserGateB() {
  const group = new THREE.Group()
  const postMat = emissiveMat(0x440000, 0xff0000, 2)
  // Posts (same as A)
  ;[-1.1, 1.1].forEach(x => {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 0.14), postMat)
    base.position.set(x, 0.15, 0)
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.8, 0.08), postMat)
    shaft.position.set(x, 1.05, 0)
    group.add(base, shaft)
  })
  // Arch top — approximated with 5 box segments forming a curve
  const archMat = emissiveMat(0x440000, 0xff0000, 2)
  const archSegs = 5
  for (let i = 0; i < archSegs; i++) {
    const t = i / (archSegs - 1)   // 0 → 1
    const angle = Math.PI + t * Math.PI  // π → 2π (bottom half of circle = arch)
    const r = 1.2
    const cx = Math.cos(angle) * r   // -1.2 → 1.2
    const cy = Math.sin(angle) * r + 2.1  // 0 at ends, +r at top
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), archMat)
    seg.position.set(cx, cy, 0)
    seg.rotation.z = angle + Math.PI / 2
    group.add(seg)
  }
  // Beam (same height as A)
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.06), emissiveMat(0x440000, 0xff0000, 3))
  beam.position.y = 1.2
  beam.name = 'beam'
  group.add(beam)
  const beam2 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.03, 0.03), emissiveMat(0x220000, 0xff4400, 2))
  beam2.position.y = 1.1
  beam2.name = 'beam2'
  group.add(beam2)
  group.userData.type = 'LASER_GATE'
  group.userData.avoidWith = 'SLIDE'
  group.userData.blinkTimer = 0
  group.userData.active = true
  group.userData.hazardAABB = { minX: -1.1, maxX: 1.1, minY: 1.07, maxY: 1.23, minZ: -0.03, maxZ: 0.03 }
  return group
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```
Expected: all PASS

- [ ] **Step 5: Verify visually — SLIDE variants visible and functional**

```bash
npm run dev
```

- [ ] **Step 6: Commit**

```bash
git add src/obstacle-types.js
git commit -m "feat: NEON_PIPE B/C and LASER_GATE B visual variants"
```

---

### Task 4: LANE obstacle variants (PATROL_BOT B+C)

**Files:**
- Modify: `src/obstacle-types.js` — replace `patrolBotB`, `patrolBotC` stubs

- [ ] **Step 1: Implement patrolBotB — Slim Bot (green)**

```js
function patrolBotB() {
  const group = new THREE.Group()
  const bodyMat = emissiveMat(0x003300, 0x00ff44, 1.5)
  // Legs
  ;[-0.1, 0.1].forEach(x => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.12), emissiveMat(0x002200, 0x00cc33, 1))
    leg.position.set(x, 0.15, 0)
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.18), emissiveMat(0x002200, 0x00cc33, 1))
    foot.position.set(x, 0.0, 0.03)
    group.add(leg, foot)
  })
  // Slim torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 0.25), bodyMat)
  torso.position.y = 0.65
  torso.name = 'botBody'
  group.add(torso)
  // Shoulder armor plates
  ;[-0.22, 0.22].forEach(x => {
    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.15), emissiveMat(0x002200, 0x00ff44, 2))
    shoulder.position.set(x, 0.8, 0)
    group.add(shoulder)
  })
  // Tall head with single large eye
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.24), bodyMat)
  head.position.y = 1.15
  head.name = 'botHead'
  group.add(head)
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x001100, emissive: 0x00ff88, emissiveIntensity: 4 })
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.04), eyeMat)
  eye.position.set(0, 1.16, 0.14)
  group.add(eye)
  // Antenna
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.35, 6), bodyMat)
  ant.position.set(0, 1.48, 0)
  const antTip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), emissiveMat(0x003300, 0x00ffaa, 4))
  antTip.position.set(0, 1.68, 0)
  group.add(ant, antTip)
  group.userData.type = 'PATROL_BOT'
  group.userData.avoidWith = 'LANE'
  group.userData.patrolDir = 1
  group.userData.patrolSpeed = 2.5
  group.userData.time = 0
  group.userData.hazardAABB = { minX: -0.25, maxX: 0.25, minY: 0, maxY: 1.35, minZ: -0.2, maxZ: 0.2 }
  return group
}
```

- [ ] **Step 2: Implement patrolBotC — Heavy Bot (orange)**

```js
function patrolBotC() {
  const group = new THREE.Group()
  const bodyMat = emissiveMat(0x331100, 0xff6600, 1.5)
  // Short thick legs
  ;[-0.18, 0.18].forEach(x => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.25, 0.2), emissiveMat(0x221100, 0xff4400, 1))
    leg.position.set(x, 0.125, 0)
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.25), emissiveMat(0x221100, 0xff4400, 1))
    foot.position.set(x, 0.0, 0.02)
    group.add(leg, foot)
  })
  // Wide low body
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.45), bodyMat)
  torso.position.y = 0.55
  torso.name = 'botBody'
  group.add(torso)
  // Chest vents
  const ventMat = emissiveMat(0x220800, 0xff3300, 2)
  ;[-0.15, 0, 0.15].forEach(x => {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.04), ventMat)
    vent.position.set(x, 0.52, 0.24)
    group.add(vent)
  })
  // Short wide head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.22, 0.35), bodyMat)
  head.position.y = 0.94
  head.name = 'botHead'
  group.add(head)
  // Visor strip
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.07, 0.04), emissiveMat(0x220000, 0xff8800, 3))
  visor.position.set(0, 0.95, 0.19)
  group.add(visor)
  // Shoulder spotlights
  ;[-0.42, 0.42].forEach(x => {
    const mount = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), emissiveMat(0x221100, 0xff4400, 1))
    mount.position.set(x, 0.72, 0)
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.1, 8), emissiveMat(0x332200, 0xffcc00, 3))
    lens.rotation.z = Math.PI / 2
    lens.position.set(x > 0 ? x + 0.08 : x - 0.08, 0.72, 0.12)
    group.add(mount, lens)
  })
  group.userData.type = 'PATROL_BOT'
  group.userData.avoidWith = 'LANE'
  group.userData.patrolDir = 1
  group.userData.patrolSpeed = 2.5
  group.userData.time = 0
  group.userData.hazardAABB = { minX: -0.25, maxX: 0.25, minY: 0, maxY: 1.35, minZ: -0.2, maxZ: 0.2 }
  return group
}
```

- [ ] **Step 3: Run tests**

```bash
npm test
```
Expected: all PASS

- [ ] **Step 4: Verify visually**

```bash
npm run dev
```

- [ ] **Step 5: Commit**

```bash
git add src/obstacle-types.js
git commit -m "feat: PATROL_BOT B (slim/green) and C (heavy/orange) variants"
```

---

### Task 5: 2-lane obstacles (WIDE_WALL, WIDE_HURDLE) + redesigned A variants

**Files:**
- Modify: `src/obstacle-types.js` — replace `wideWallA/B`, `wideHurdleA/B` stubs

The spawn path was already added in Task 1. This task only adds the real mesh factories.

- [ ] **Step 1: Write test for 2-lane AABB values**

Add to `tests/obstacle-variants.test.js`:

```js
describe('2-lane obstacles', () => {
  it('WIDE_WALL hazardAABB covers 2 lane centers', () => {
    for (const factory of OBSTACLE_VARIANTS.WIDE_WALL) {
      const g = factory()
      const hz = g.userData.hazardAABB
      // Must hit player at x=-2.5 (offset -1.25 + hz.minX must be < -2.5 + 0.28)
      // Obstacle at x=-1.25: player at x=-2.5 → pos.x + hz.minX < -2.5 + 0.28 = -2.22
      expect(hz.minX).toBeLessThan(-1.2)  // -1.25 + minX < -2.22 → minX < -0.97
      // Must hit player at x=0 → pos.x + hz.maxX > 0 - 0.28 = -0.28
      expect(hz.maxX).toBeGreaterThan(0.97)
    }
  })

  it('WIDE_HURDLE hazardAABB is at slide height', () => {
    for (const factory of OBSTACLE_VARIANTS.WIDE_HURDLE) {
      const g = factory()
      const hz = g.userData.hazardAABB
      expect(hz.minY).toBeGreaterThanOrEqual(0.9)
      expect(hz.maxY).toBeLessThanOrEqual(1.5)
    }
  })
})
```

- [ ] **Step 2: Run test — confirm FAIL on AABB check**

```bash
npx vitest run tests/obstacle-variants.test.js
```
Stubs return HOLOGRAM_SIGN/NEON_PIPE AABB which is narrower — FAIL expected.

- [ ] **Step 3: Implement wideWallA — Security Blast Door**

```js
function wideWallA() {
  const group = new THREE.Group()
  const doorMat = emissiveMat(0x111111, 0x333333, 0.4)
  // Main door panel
  const door = new THREE.Mesh(new THREE.BoxGeometry(2.9, 2.0, 0.14), doorMat)
  door.position.y = 1.0
  group.add(door)
  // Warning stripes (diagonal yellow-black pattern via horizontal alternating bands)
  const warnYellow = emissiveMat(0x333300, 0xffcc00, 1.5)
  const warnBlack = emissiveMat(0x080808, 0x111100, 0.3)
  for (let i = 0; i < 8; i++) {
    const mat = i % 2 === 0 ? warnYellow : warnBlack
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.22, 0.05), mat)
    stripe.position.set(0, 0.15 + i * 0.23, 0.1)
    group.add(stripe)
  }
  // Central warning light cluster
  const warnLightMat = emissiveMat(0x440000, 0xff2200, 4)
  ;[-0.3, 0, 0.3].forEach(x => {
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), warnLightMat)
    light.position.set(x, 1.0, 0.12)
    group.add(light)
  })
  // Frame
  const frameMat = emissiveMat(0x222222, 0x666666, 1)
  ;[-1.46, 1.46].forEach(x => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.1, 0.18), frameMat)
    post.position.set(x, 1.05, 0)
    group.add(post)
  })
  ;[0.0, 2.05].forEach(y => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.1, 0.18), frameMat)
    bar.position.set(0, y, 0)
    group.add(bar)
  })
  // Searchlight on top
  const searchMat = emissiveMat(0x333300, 0xffee88, 3)
  const searchBody = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.2, 8), searchMat)
  searchBody.position.set(0, 2.2, 0)
  group.add(searchBody)
  group.userData.type = 'WIDE_WALL'
  group.userData.avoidWith = 'JUMP'
  group.userData.time = 0
  group.userData.hazardAABB = { minX: -1.45, maxX: 1.45, minY: 0, maxY: 1.9, minZ: -0.15, maxZ: 0.15 }
  return group
}
```

- [ ] **Step 4: Implement wideWallB — Energy Barrier**

```js
function wideWallB() {
  const group = new THREE.Group()
  // Generator posts at each end
  const postMat = emissiveMat(0x001133, 0x0044ff, 2)
  ;[-1.5, 1.5].forEach(x => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.1, 0.18), postMat)
    post.position.set(x, 1.05, 0)
    group.add(post)
    // Generator coil rings
    ;[0.5, 1.0, 1.5].forEach(y => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.03, 6, 10), emissiveMat(0x002266, 0x0088ff, 3))
      ring.position.set(x, y, 0)
      group.add(ring)
    })
  })
  // Force field — semi-transparent plane
  const fieldMat = new THREE.MeshStandardMaterial({
    color: 0x001133, emissive: 0x0055ff, emissiveIntensity: 1.5,
    transparent: true, opacity: 0.35, side: THREE.DoubleSide,
  })
  const field = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 2.0), fieldMat)
  field.position.y = 1.0
  group.add(field)
  // Electric current lines (horizontal strips)
  const currentMat = emissiveMat(0x001155, 0x44aaff, 3)
  ;[0.4, 0.9, 1.4, 1.8].forEach(y => {
    const line = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.03, 0.03), currentMat)
    line.position.set(0, y, 0.02)
    group.add(line)
  })
  group.userData.type = 'WIDE_WALL'
  group.userData.avoidWith = 'JUMP'
  group.userData.time = 0
  group.userData.hazardAABB = { minX: -1.45, maxX: 1.45, minY: 0, maxY: 1.9, minZ: -0.15, maxZ: 0.15 }
  return group
}
```

- [ ] **Step 5: Implement wideHurdleA — Scanner Arm**

```js
function wideHurdleA() {
  const group = new THREE.Group()
  const postMat = emissiveMat(0x222222, 0x555555, 0.8)
  // Support posts at each end
  ;[-1.5, 1.5].forEach(x => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.3, 0.12), postMat)
    post.position.set(x, 0.65, 0)
    group.add(post)
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.22), postMat)
    base.position.set(x, 0.0, 0)
    group.add(base)
  })
  // Horizontal scan beam arm
  const armMat = emissiveMat(0x003311, 0x00ff66, 2)
  const arm = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.07, 0.07), armMat)
  arm.position.y = 1.2
  arm.name = 'pipe'  // reuse 'pipe' name for emissive pulse update
  group.add(arm)
  // Emitter nodes at arm ends
  const emitterMat = emissiveMat(0x002211, 0x00ff88, 3)
  ;[-1.5, 1.5].forEach(x => {
    const emitter = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.14), emitterMat)
    emitter.position.set(x, 1.2, 0)
    group.add(emitter)
  })
  // Sweep indicator line (visual only — slightly above arm)
  const sweepMat = new THREE.MeshStandardMaterial({ color: 0x001100, emissive: 0x00ff44, emissiveIntensity: 1, transparent: true, opacity: 0.4 })
  const sweep = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.18, 0.04), sweepMat)
  sweep.position.y = 1.22
  group.add(sweep)
  group.userData.type = 'WIDE_HURDLE'
  group.userData.avoidWith = 'SLIDE'
  group.userData.time = 0
  group.userData.hazardAABB = { minX: -1.45, maxX: 1.45, minY: 0.95, maxY: 1.45, minZ: -0.15, maxZ: 0.15 }
  return group
}
```

- [ ] **Step 6: Implement wideHurdleB — Floor Sensor**

```js
function wideHurdleB() {
  const group = new THREE.Group()
  const houseMat = emissiveMat(0x111111, 0x444444, 0.5)
  // Low-profile housing strip (flush to ground)
  const housing = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.12, 0.3), houseMat)
  housing.position.y = 0.06
  group.add(housing)
  // Vent grilles on housing top
  const ventMat = emissiveMat(0x220000, 0x660000, 0.8)
  for (let i = -5; i <= 5; i++) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.25), ventMat)
    vent.position.set(i * 0.26, 0.12, 0)
    group.add(vent)
  }
  // Scan line at 1.1 height
  const scanMat = emissiveMat(0x330000, 0xff2200, 3)
  const scan = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.06, 0.06), scanMat)
  scan.position.y = 1.1
  scan.name = 'pipe'  // reuse for pulse update
  group.add(scan)
  // Side indicator lights
  ;[-1.45, 1.45].forEach(x => {
    const ind = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), emissiveMat(0x330000, 0xff0000, 4))
    ind.position.set(x, 0.09, 0.16)
    group.add(ind)
  })
  group.userData.type = 'WIDE_HURDLE'
  group.userData.avoidWith = 'SLIDE'
  group.userData.time = 0
  group.userData.hazardAABB = { minX: -1.45, maxX: 1.45, minY: 0.95, maxY: 1.45, minZ: -0.15, maxZ: 0.15 }
  return group
}
```

- [ ] **Step 7: Add WIDE_WALL and WIDE_HURDLE update handling in obstacles.js**

In the `update` function in `src/obstacles.js`, add pulse animation for wide types (after existing GAP block):

```js
if (type === 'WIDE_WALL') {
  obj.userData.time += delta
  // pulsing warning lights
  const wl = obj.getObjectByName('warnLight')
  // (no named mesh — skip; individual emissive fluctuation handled per-material is not needed here)
}

if (type === 'WIDE_HURDLE') {
  obj.userData.time += delta
  const pipe = obj.getObjectByName('pipe')
  if (pipe) pipe.material.emissiveIntensity = 2 + 1.5 * Math.abs(Math.sin(obj.userData.time * 5))
}
```

- [ ] **Step 8: Run tests**

```bash
npm test
```
Expected: all PASS including new AABB tests

- [ ] **Step 9: Verify visually — play to distance 600, confirm wide obstacles appear**

```bash
npm run dev
```
Cheat: in browser console run `gameState.distance = 700` after game starts to trigger wide spawns early and verify only 1 free lane remains passable.

- [ ] **Step 10: Commit**

```bash
git add src/obstacle-types.js src/obstacles.js tests/obstacle-variants.test.js
git commit -m "feat: WIDE_WALL and WIDE_HURDLE 2-lane obstacles"
```

---

### Task 6: SPINNER_BOT

**Files:**
- Modify: `src/obstacle-types.js` — replace `spinnerBotA` stub with real implementation
- Note: `calcSpinnerAABB` and the obstacles.js update block were already added in Task 1

- [ ] **Step 1: Write spinner AABB test (should already pass from Task 1 stubs)**

```bash
npx vitest run tests/obstacle-variants.test.js --reporter=verbose
```
Confirm `calcSpinnerAABB` tests pass.

- [ ] **Step 2: Implement spinnerBotA**

Replace the stub in `src/obstacle-types.js`:

```js
function spinnerBotA() {
  const group = new THREE.Group()
  const bodyMat = emissiveMat(0x220033, 0xaa00ff, 1.5)
  // Legs
  ;[-0.1, 0.1].forEach(x => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, 0.12), emissiveMat(0x110022, 0x7700cc, 1))
    leg.position.set(x, 0.14, 0)
    group.add(leg)
  })
  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.3), bodyMat)
  body.position.y = 0.52
  group.add(body)
  // Chest warning strobe
  const strobeMat = emissiveMat(0x330000, 0xff2200, 3)
  const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), strobeMat)
  strobe.position.set(0, 0.6, 0.16)
  strobe.name = 'strobe'
  group.add(strobe)
  // Arm group — rotates around Y axis
  const armGroup = new THREE.Group()
  armGroup.position.y = 0.75
  armGroup.name = 'spinArm'
  // Two arm segments (opposite directions)
  ;[-1, 1].forEach(dir => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.06, 0.06), emissiveMat(0x220033, 0xaa00ff, 2))
    arm.position.set(dir * 0.325, 0, 0)
    armGroup.add(arm)
    // Glowing tip
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), emissiveMat(0x330044, 0xff00ff, 4))
    tip.position.set(dir * 0.65, 0, 0)
    armGroup.add(tip)
  })
  group.add(armGroup)
  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.22), bodyMat)
  head.position.y = 0.85
  group.add(head)
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x220033, emissive: 0xdd00ff, emissiveIntensity: 4 })
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.04), eyeMat)
  eye.position.set(0, 0.87, 0.12)
  group.add(eye)
  group.userData.type = 'SPINNER_BOT'
  group.userData.avoidWith = 'TIMING'
  group.userData.spinAngle = 0
  group.userData.spinSpeed = 1.5
  group.userData.time = 0
  group.userData.hazardAABB = calcSpinnerAABB(0)
  return group
}
```

- [ ] **Step 3: Run tests**

```bash
npm test
```
Expected: all PASS

- [ ] **Step 4: Add strobe animation to obstacles.js SPINNER_BOT update block**

In the SPINNER_BOT update section in `src/obstacles.js` (already added in Task 1), add strobe:

```js
if (type === 'SPINNER_BOT') {
  obj.userData.spinAngle += delta * obj.userData.spinSpeed
  const spinArm = obj.getObjectByName('spinArm')
  if (spinArm) spinArm.rotation.y = obj.userData.spinAngle
  obj.userData.hazardAABB = calcSpinnerAABB(obj.userData.spinAngle)
  // Strobe flashes when arm spans across lane (|cos| > 0.7 = danger zone)
  const strobe = obj.getObjectByName('strobe')
  if (strobe) {
    const inDanger = Math.abs(Math.cos(obj.userData.spinAngle)) > 0.7
    strobe.material.emissiveIntensity = inDanger ? 4 : 0.5
  }
}
```

- [ ] **Step 5: Verify visually — play to distance 1000, SPINNER_BOT should appear**

```bash
npm run dev
```
Set `gameState.distance = 1100` in browser console. Confirm:
- Arm rotates visually
- Player is hit when arm is horizontal, safe when arm is vertical
- Strobe flashes in sync with danger window

- [ ] **Step 6: Commit**

```bash
git add src/obstacle-types.js src/obstacles.js
git commit -m "feat: SPINNER_BOT with rotating arm timing mechanic"
```

---

### Task 7: CHARGER_BOT + HUD warning

**Files:**
- Modify: `src/obstacle-types.js` — replace `chargerBotA` stub
- Modify: `src/main.js` — add charge warning HUD element
- Modify: `src/style.css` — charge warning style

- [ ] **Step 1: Confirm tickChargerBot tests pass from Task 1**

```bash
npx vitest run tests/obstacle-variants.test.js --reporter=verbose
```

- [ ] **Step 2: Implement chargerBotA**

Replace stub in `src/obstacle-types.js`:

```js
function chargerBotA() {
  const group = new THREE.Group()
  const bodyMat = emissiveMat(0x002233, 0x00ccff, 1.5)
  // Forward-leaning base legs (tilted forward)
  ;[-0.15, 0.15].forEach(x => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.32, 0.18), emissiveMat(0x001122, 0x0099cc, 1))
    leg.position.set(x, 0.16, -0.06)
    leg.rotation.x = -0.2
    group.add(leg)
  })
  // Wide body, forward-swept
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.55, 0.42), bodyMat)
  torso.position.set(0, 0.6, -0.05)
  torso.rotation.x = -0.12
  torso.name = 'chargerBody'
  group.add(torso)
  // Booster nozzles on chest (facing forward = -Z direction)
  const nozzleMat = emissiveMat(0x002244, 0x0066ff, 2)
  ;[-0.14, 0, 0.14].forEach(x => {
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.14, 8), nozzleMat)
    nozzle.rotation.x = Math.PI / 2
    nozzle.position.set(x, 0.58, -0.26)
    group.add(nozzle)
    // Nozzle glow
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 8), emissiveMat(0x001133, 0x00eeff, 4))
    glow.rotation.x = Math.PI / 2
    glow.position.set(x, 0.58, -0.32)
    group.add(glow)
  })
  // Forward-swept shoulder guards
  ;[-0.38, 0.38].forEach(x => {
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.35), emissiveMat(0x001133, 0x0088ff, 1.5))
    guard.position.set(x, 0.72, -0.1)
    guard.rotation.x = -0.2
    group.add(guard)
  })
  // Head (low, armored)
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.3), bodyMat)
  head.position.set(0, 0.94, -0.04)
  group.add(head)
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.04), emissiveMat(0x001133, 0x00ffff, 4))
  visor.position.set(0, 0.94, 0.12)
  group.add(visor)
  group.userData.type = 'CHARGER_BOT'
  group.userData.avoidWith = 'LANE'
  group.userData.chargeState = 'APPROACH'
  group.userData.windupTimer = 0
  group.userData.chargeTimer = 0
  group.userData.time = 0
  group.userData.baseX = 0
  group.userData.hazardAABB = { minX: -0.25, maxX: 0.25, minY: 0, maxY: 1.1, minZ: -0.2, maxZ: 0.2 }
  return group
}
```

- [ ] **Step 3: Add charge-warn element to main.js**

In `src/main.js`, after the existing DOM setup (around line 26), add:

```js
const chargeWarnEl = document.createElement('div')
chargeWarnEl.id = 'charge-warn'
chargeWarnEl.textContent = '⚡ CHARGE'
chargeWarnEl.style.display = 'none'
document.getElementById('hud').appendChild(chargeWarnEl)
```

- [ ] **Step 4: Add charge-warn style to style.css**

Find the existing `#drone-beam-warn` style and add after it:

```css
#charge-warn {
  position: absolute;
  bottom: 120px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 16px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 14px;
  font-weight: bold;
  letter-spacing: 2px;
  color: #fff;
  background: rgba(0, 150, 200, 0.8);
  box-shadow: 0 0 12px #00ccff;
}
```

- [ ] **Step 5: Run tests**

```bash
npm test
```
Expected: all PASS

- [ ] **Step 6: Verify visually**

```bash
npm run dev
```
Set `gameState.distance = 1100` in browser console.
Confirm:
- CHARGER_BOT approaches, stops and vibrates with ⚡ CHARGE HUD icon visible
- Body flashes during WINDUP
- Then charges at high speed
- If player stays in same lane, collision occurs
- If player changes lane before charge, they survive

- [ ] **Step 7: Commit**

```bash
git add src/obstacle-types.js src/main.js src/style.css
git commit -m "feat: CHARGER_BOT with stop-and-charge timing mechanic + HUD warning"
```

---

### Task 8: Redesign existing A variants (visual upgrade)

**Files:**
- Modify: `src/obstacle-types.js` — replace `hologramSignA`, `neonPipeA`, `gapA`, `laserGateA`, `patrolBotA` with improved versions

This task does not change any AABB values or mechanics — purely visual upgrade.

- [ ] **Step 1: Upgrade hologramSignA**

Replace the factory in `src/obstacle-types.js`:

```js
function hologramSignA() {
  const group = new THREE.Group()
  // Dual base mounting posts
  const postMat = emissiveMat(0x001133, 0x0044aa, 1.2)
  ;[-0.85, 0.85].forEach(x => {
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.08), postMat)
    shaft.position.set(x, 0.175, 0)
    group.add(shaft)
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.2), postMat)
    foot.position.set(x, 0.0, 0)
    group.add(foot)
  })
  // Panel
  const panel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.95, 0.08), emissiveMat(0x003366, 0x0066ff))
  panel.position.y = 1.075
  panel.name = 'signPanel'
  group.add(panel)
  // Double frame — outer
  const outerMat = emissiveMat(0x002244, 0x00aaff, 2.5)
  ;[2.08, 0.08].forEach(y => {
    const e = new THREE.Mesh(new THREE.BoxGeometry(2.48, 0.06, 0.06), outerMat)
    e.position.set(0, y, 0.1)
    group.add(e)
  })
  ;[-1.22, 1.22].forEach(x => {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.05, 0.06), outerMat)
    e.position.set(x, 1.08, 0.1)
    group.add(e)
  })
  // Inner accent strip
  const accentMat = emissiveMat(0x001144, 0x0088ff, 3.5)
  const strip = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.04, 0.04), accentMat)
  strip.position.set(0, 0.28, 0.1)
  group.add(strip)
  // Corner joints
  const jointMat = emissiveMat(0x003366, 0x0099ff, 2)
  ;[[-1.2, 2.06], [1.2, 2.06], [-1.2, 0.1], [1.2, 0.1]].forEach(([x, y]) => {
    const j = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.13), jointMat)
    j.position.set(x, y, 0.1)
    group.add(j)
  })
  // UI elements: bar graph
  const uiMat = emissiveMat(0x002233, 0x00ccff, 1.2)
  ;[0.5, 0.7, 0.4, 0.6, 0.8].forEach((h, i) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.18, h, 0.04), uiMat)
    bar.position.set(-0.44 + i * 0.22, 0.55 + h / 2, 0.1)
    group.add(bar)
  })
  // Status text lines (upper area)
  ;[1.7, 1.55, 1.42].forEach(y => {
    const line = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.055, 0.04), uiMat)
    line.position.set(0, y, 0.1)
    group.add(line)
  })
  group.userData.type = 'HOLOGRAM_SIGN'
  group.userData.avoidWith = 'JUMP'
  group.userData.time = 0
  group.userData.glitchTimer = 1.2 + Math.random() * 0.8
  group.userData.hazardAABB = { minX: -0.9, maxX: 0.9, minY: 0, maxY: 1.9, minZ: -0.15, maxZ: 0.15 }
  return group
}
```

- [ ] **Step 2: Upgrade neonPipeA**

```js
function neonPipeA() {
  const group = new THREE.Group()
  const pipeGeo = new THREE.CylinderGeometry(0.14, 0.14, 2.5, 8)
  pipeGeo.rotateZ(Math.PI / 2)
  const pipe = new THREE.Mesh(pipeGeo, emissiveMat(0x004444, 0x00ffff))
  pipe.position.y = 1.2
  pipe.name = 'pipe'
  group.add(pipe)
  // Hex-bolt flanges at ends
  const flangeMat = emissiveMat(0x006666, 0x00ffff, 3)
  ;[-1.25, 1.25].forEach(x => {
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.07, 6), flangeMat)
    flange.rotation.z = Math.PI / 2
    flange.position.set(x, 1.2, 0)
    group.add(flange)
    // Bolt dots on flange face
    ;[0, 1, 2, 3, 4, 5].forEach(i => {
      const a = (i / 6) * Math.PI * 2
      const bolt = new THREE.Mesh(new THREE.SphereGeometry(0.025, 4, 4), emissiveMat(0x003333, 0x00cccc, 2))
      bolt.position.set(x + (x > 0 ? 0.04 : -0.04), 1.2 + Math.sin(a) * 0.14, Math.cos(a) * 0.14)
      group.add(bolt)
    })
  })
  // Support brackets with warning tape
  const bracketMat = emissiveMat(0x003333, 0x006666, 1)
  ;[-0.75, 0.75].forEach(x => {
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.2, 0.07), bracketMat)
    bracket.position.set(x, 0.6, 0)
    group.add(bracket)
    // Warning tape stripes on bracket
    ;[0.2, 0.5, 0.8].forEach(t => {
      const tape = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.09), emissiveMat(0x333300, 0xffcc00, 1.5))
      tape.position.set(x, t * 1.2, 0)
      group.add(tape)
    })
  })
  // Central junction box
  const junctionMat = emissiveMat(0x003333, 0x009999, 1.5)
  const junction = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.22), junctionMat)
  junction.position.set(0, 1.2, 0)
  group.add(junction)
  // Pressure gauge on top of junction
  const gaugeMat = emissiveMat(0x333300, 0xffcc00, 2)
  const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 10), gaugeMat)
  gauge.position.set(0, 1.32, 0)
  group.add(gauge)
  group.userData.type = 'NEON_PIPE'
  group.userData.avoidWith = 'SLIDE'
  group.userData.time = 0
  group.userData.hazardAABB = { minX: -1.3, maxX: 1.3, minY: 0.95, maxY: 1.45, minZ: -0.15, maxZ: 0.15 }
  return group
}
```

- [ ] **Step 3: Upgrade gapA**

```js
function gapA() {
  const group = new THREE.Group()
  // Dark void
  const voidGeo = new THREE.PlaneGeometry(2.4, 3)
  voidGeo.rotateX(-Math.PI / 2)
  const voidFloor = new THREE.Mesh(voidGeo, new THREE.MeshBasicMaterial({ color: 0x000000 }))
  voidFloor.position.y = -0.05
  group.add(voidFloor)
  // Grid pattern on void floor
  const gridMat = new THREE.MeshStandardMaterial({ color: 0x110000, emissive: 0x330000, emissiveIntensity: 1 })
  for (let xi = -1; xi <= 1; xi++) {
    const hLine = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.01, 0.03), gridMat)
    hLine.position.set(0, -0.04, xi * 0.6)
    group.add(hLine)
  }
  for (let zi = -2; zi <= 2; zi++) {
    const vLine = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.01, 3), gridMat)
    vLine.position.set(zi * 0.55, -0.04, 0)
    group.add(vLine)
  }
  // Warning edges
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff3300, emissiveIntensity: 4 })
  ;[-1.5, 1.5].forEach((z, i) => {
    const e = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 0.06), edgeMat)
    e.position.set(0, 0, z)
    if (i === 0) e.name = 'gapEdge'
    group.add(e)
  })
  ;[-1.2, 1.2].forEach(x => {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 3), edgeMat)
    e.position.set(x, 0, 0)
    group.add(e)
  })
  // Broken concrete chunks on edges (6 pieces)
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 })
  ;[-1.1, -0.3, 0.3, 1.1].forEach(x => {
    ;[-1.3, 1.3].forEach(z => {
      if (Math.random() > 0.5) {
        const chunk = new THREE.Mesh(
          new THREE.BoxGeometry(0.15 + Math.random() * 0.1, 0.06 + Math.random() * 0.08, 0.15 + Math.random() * 0.1),
          concreteMat
        )
        chunk.position.set(x, 0.03, z)
        chunk.rotation.y = Math.random() * Math.PI
        group.add(chunk)
      }
    })
  })
  // Depth indicator markers (vertical lines at each side)
  const depthMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2200, emissiveIntensity: 2 })
  ;[-1.2, 1.2].forEach(x => {
    const marker = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.4, 0.03), depthMat)
    marker.position.set(x, -0.2, 0)
    group.add(marker)
  })
  // Cross markers
  const crossMat = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff0000, emissiveIntensity: 2 })
  const diagGeo = new THREE.BoxGeometry(3.6, 0.04, 0.04)
  const cross1 = new THREE.Mesh(diagGeo, crossMat); cross1.position.y = 0.02; cross1.rotation.y = Math.PI / 4
  const cross2 = new THREE.Mesh(diagGeo, crossMat); cross2.position.y = 0.02; cross2.rotation.y = -Math.PI / 4
  group.add(cross1, cross2)
  group.userData.type = 'GAP'
  group.userData.avoidWith = 'JUMP'
  group.userData.time = 0
  group.userData.hazardAABB = { minX: -1.2, maxX: 1.2, minY: -10, maxY: 0.05, minZ: -1.5, maxZ: 1.5 }
  return group
}
```

- [ ] **Step 4: Upgrade laserGateA**

```js
function laserGateA() {
  const group = new THREE.Group()
  const postMat = emissiveMat(0x440000, 0xff0000, 2)
  ;[-1.1, 1.1].forEach(x => {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.16), postMat)
    base.position.set(x, 0.15, 0)
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.8, 0.09), postMat)
    shaft.position.set(x, 1.05, 0)
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.16), postMat)
    top.position.set(x, 1.95, 0)
    group.add(base, shaft, top)
    // Heat sink fins (3 per post)
    const finMat = emissiveMat(0x330000, 0xcc0000, 1.5)
    ;[0.6, 1.0, 1.4].forEach(y => {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.18), finMat)
      fin.position.set(x, y, 0)
      group.add(fin)
    })
    // Emitter sphere at top
    const emitter = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), emissiveMat(0x440000, 0xff2200, 4))
    emitter.position.set(x, 2.14, 0)
    group.add(emitter)
  })
  // Crossbar with chevrons
  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.09, 0.09), emissiveMat(0x440000, 0xff0000, 2))
  crossbar.position.y = 2.1
  group.add(crossbar)
  // Chevron warning markers on crossbar
  const chevMat = emissiveMat(0x333300, 0xffcc00, 2)
  ;[-0.5, 0, 0.5].forEach(x => {
    const chev = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.07), chevMat)
    chev.position.set(x, 2.1, 0.06)
    group.add(chev)
  })
  // Beams
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.06), emissiveMat(0x440000, 0xff0000, 3))
  beam.position.y = 1.2
  beam.name = 'beam'
  group.add(beam)
  const beam2 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.03, 0.03), emissiveMat(0x220000, 0xff4400, 2))
  beam2.position.y = 1.1
  beam2.name = 'beam2'
  group.add(beam2)
  group.userData.type = 'LASER_GATE'
  group.userData.avoidWith = 'SLIDE'
  group.userData.blinkTimer = 0
  group.userData.active = true
  group.userData.hazardAABB = { minX: -1.1, maxX: 1.1, minY: 1.07, maxY: 1.23, minZ: -0.03, maxZ: 0.03 }
  return group
}
```

- [ ] **Step 5: Upgrade patrolBotA**

```js
function patrolBotA() {
  const group = new THREE.Group()
  const bodyMat = emissiveMat(0x222200, 0xffcc00, 1.5)
  // Feet
  ;[-0.13, 0.13].forEach(x => {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.22), emissiveMat(0x111100, 0xaa8800, 1))
    foot.position.set(x, 0.03, 0.03)
    group.add(foot)
    // Leg
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.14), emissiveMat(0x1a1a00, 0xcc9900, 1.2))
    leg.position.set(x, 0.2, 0)
    group.add(leg)
  })
  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.38), bodyMat)
  body.position.y = 0.59
  body.name = 'botBody'
  group.add(body)
  // Chest sensor panel
  const sensorMat = emissiveMat(0x221100, 0xff6600, 2)
  const sensor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.04), sensorMat)
  sensor.position.set(0, 0.6, 0.2)
  group.add(sensor)
  // Sensor grid lines
  const gridMat = emissiveMat(0x332200, 0xffaa00, 3)
  ;[-0.05, 0.05].forEach(x => {
    const gl = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.03), gridMat)
    gl.position.set(x, 0.6, 0.22)
    group.add(gl)
  })
  // Arm stubs
  ;[-0.32, 0.32].forEach(x => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.12), emissiveMat(0x1a1a00, 0xcc9900, 1))
    arm.position.set(x, 0.62, 0)
    group.add(arm)
  })
  // Head with visor
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.26, 0.3), bodyMat)
  head.position.y = 1.02
  head.name = 'botHead'
  group.add(head)
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.07, 0.04), emissiveMat(0x440000, 0xff6600, 3))
  visor.position.set(0, 1.02, 0.17)
  group.add(visor)
  // Eyes (small, below visor)
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x440000, emissive: 0xff2200, emissiveIntensity: 3 })
  ;[-0.07, 0.07].forEach(x => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeMat)
    eye.position.set(x, 1.0, 0.16)
    group.add(eye)
  })
  // Antenna
  const antShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.32, 6), bodyMat)
  antShaft.position.set(0, 1.41, 0)
  const antTip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), emissiveMat(0x333300, 0xffff00, 3))
  antTip.position.set(0, 1.6, 0)
  group.add(antShaft, antTip)
  group.userData.type = 'PATROL_BOT'
  group.userData.avoidWith = 'LANE'
  group.userData.patrolDir = 1
  group.userData.patrolSpeed = 2.5
  group.userData.time = 0
  group.userData.hazardAABB = { minX: -0.25, maxX: 0.25, minY: 0, maxY: 1.35, minZ: -0.2, maxZ: 0.2 }
  return group
}
```

- [ ] **Step 6: Run full test suite**

```bash
npm test
```
Expected: all PASS

- [ ] **Step 7: Verify all A variants visually improved**

```bash
npm run dev
```
Play through — all 5 original obstacle types should look more detailed than before.

- [ ] **Step 8: Commit**

```bash
git add src/obstacle-types.js
git commit -m "feat: redesign all obstacle A variants with added geometric detail"
```
