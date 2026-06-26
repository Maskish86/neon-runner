# Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve visuals of obstacles, collectibles, and player with new geometry, per-type shapes, and animations — no new dependencies, no shader code.

**Architecture:** Three tasks touch `src/obstacle-types.js` + `src/obstacles.js` together (geometry + animation update), one touches `src/collectibles.js`, one touches `src/player.js`. All animations driven by `userData.time += delta` in existing update loops. No new modules.

**Tech Stack:** Three.js r165 built-in geometries (TorusGeometry, IcosahedronGeometry, SphereGeometry, CylinderGeometry). Vanilla JS ES modules.

## Global Constraints

- No custom GLSL shaders — all effects via JS-driven `emissiveIntensity`, rotation, position.
- AABB hazard values in `userData.hazardAABB` may change where geometry changes warrant it.
- `boxesOverlap` and `calcProximityDelta` tests must continue to pass after every task (`npm test`).
- Three.js scene modules are NOT unit-tested — use `npm run dev` + browser for visual verification.
- Pool architecture unchanged: factories return same `{ group, userData }` shape; `initObstacles` and `initCollectibles` are not structurally changed.
- Never call `setFromObject` on obstacle groups — AABB is always computed from `userData.hazardAABB` offsets.

---

### Task 1: PATROL_BOT — eyes, antenna, bob/lean animation

**Files:**
- Modify: `src/obstacle-types.js` (PATROL_BOT factory)
- Modify: `src/obstacles.js` (spawnOne reset + update loop)

**Interfaces:**
- Produces: `botBody` and `botHead` named meshes accessible via `obj.getObjectByName()`; `userData.time` reset at spawn

- [ ] **Step 1: Update PATROL_BOT factory in `src/obstacle-types.js`**

Replace the entire `PATROL_BOT()` factory:

```js
PATROL_BOT() {
  const group = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.4), emissiveMat(0x222200, 0xffcc00, 1.5))
  body.position.y = 0.5
  body.name = 'botBody'
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.3), emissiveMat(0x333300, 0xffcc00, 2))
  head.position.y = 1.0
  head.name = 'botHead'
  // Eyes
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x440000, emissive: 0xff2200, emissiveIntensity: 3 })
  const eyeGeo = new THREE.SphereGeometry(0.05, 6, 6)
  const lEye = new THREE.Mesh(eyeGeo, eyeMat); lEye.position.set(-0.07, 1.02, 0.16)
  const rEye = new THREE.Mesh(eyeGeo, eyeMat.clone()); rEye.position.set(0.07, 1.02, 0.16)
  // Antenna
  const antennaShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6),
    emissiveMat(0x222200, 0xffcc00, 2)
  )
  antennaShaft.position.set(0, 1.4, 0)
  const antennaTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 6, 6),
    emissiveMat(0x333300, 0xffff00, 3)
  )
  antennaTip.position.set(0, 1.58, 0)
  group.add(body, head, lEye, rEye, antennaShaft, antennaTip)
  group.userData.type = 'PATROL_BOT'
  group.userData.avoidWith = 'LANE'
  group.userData.patrolDir = 1
  group.userData.patrolSpeed = 2.5
  group.userData.time = 0
  group.userData.hazardAABB = { minX: -0.25, maxX: 0.25, minY: 0, maxY: 1.35, minZ: -0.2, maxZ: 0.2 }
  return group
},
```

- [ ] **Step 2: Add time reset in `spawnOne()` in `src/obstacles.js`**

In the existing `if (entry.obj.userData.type === 'PATROL_BOT')` block, add the time reset:

```js
if (entry.obj.userData.type === 'PATROL_BOT') {
  entry.obj.userData.patrolDir = Math.random() > 0.5 ? 1 : -1
  entry.obj.userData.time = 0
}
```

- [ ] **Step 3: Add bob/lean animation in `update()` in `src/obstacles.js`**

Replace the existing PATROL_BOT block in the `pool.forEach` loop:

```js
if (obj.userData.type === 'PATROL_BOT') {
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
```

- [ ] **Step 4: Run tests**

```bash
npm test
```
Expected: all tests pass (PATROL_BOT has no unit tests; this verifies no regressions).

- [ ] **Step 5: Visual verify**

```bash
npm run dev
```
Open http://localhost:3000. Play until PATROL_BOT spawns. Verify: red eyes visible on head front, antenna with yellow tip on top, smooth bobbing up/down, slight tilt toward patrol direction.

- [ ] **Step 6: Commit**

```bash
git add src/obstacle-types.js src/obstacles.js
git commit -m "feat: PATROL_BOT eyes, antenna, bob/lean animation"
```

---

### Task 2: HOLOGRAM_SIGN — frame, text lines, flicker

**Files:**
- Modify: `src/obstacle-types.js` (HOLOGRAM_SIGN factory)
- Modify: `src/obstacles.js` (spawnOne reset + update loop)

**Interfaces:**
- Produces: `signPanel` named mesh accessible via `obj.getObjectByName()`; `userData.time` and `userData.glitchTimer`

- [ ] **Step 1: Update HOLOGRAM_SIGN factory in `src/obstacle-types.js`**

Replace the entire `HOLOGRAM_SIGN()` factory:

```js
HOLOGRAM_SIGN() {
  const group = new THREE.Group()
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 1.5, 0.1),
    emissiveMat(0x003366, 0x0066ff)
  )
  panel.position.y = 1.4
  panel.name = 'signPanel'
  group.add(panel)
  // Frame bars
  const frameMat = emissiveMat(0x002244, 0x00aaff, 2.5)
  ;[2.15, 0.65].forEach(y => {
    const e = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.05, 0.05), frameMat)
    e.position.set(0, y, 0.06)
    group.add(e)
  })
  ;[-1.2, 1.2].forEach(x => {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.55, 0.05), frameMat)
    e.position.set(x, 1.4, 0.06)
    group.add(e)
  })
  // Text lines
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
  group.userData.hazardAABB = { minX: -0.9, maxX: 0.9, minY: 0.65, maxY: 1.9, minZ: -0.15, maxZ: 0.15 }
  return group
},
```

- [ ] **Step 2: Add reset in `spawnOne()` in `src/obstacles.js`**

After the existing PATROL_BOT and LASER_GATE reset blocks, add:

```js
if (entry.obj.userData.type === 'HOLOGRAM_SIGN') {
  entry.obj.userData.time = 0
  entry.obj.userData.glitchTimer = 1.2 + Math.random() * 0.8
}
```

- [ ] **Step 3: Add flicker animation in `update()` in `src/obstacles.js`**

Inside the `pool.forEach` loop, after the LASER_GATE block, add:

```js
if (obj.userData.type === 'HOLOGRAM_SIGN') {
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
```

- [ ] **Step 4: Run tests**

```bash
npm test
```
Expected: all tests pass.

- [ ] **Step 5: Visual verify**

Play until HOLOGRAM_SIGN spawns. Verify: cyan border frame visible, 3 horizontal text lines inside panel, panel brightness oscillates, occasional brief glitch to near-black.

- [ ] **Step 6: Commit**

```bash
git add src/obstacle-types.js src/obstacles.js
git commit -m "feat: HOLOGRAM_SIGN frame, text lines, flicker animation"
```

---

### Task 3: NEON_PIPE — end caps, brackets, pulse

**Files:**
- Modify: `src/obstacle-types.js` (NEON_PIPE factory)
- Modify: `src/obstacles.js` (spawnOne reset + update loop)

**Interfaces:**
- Produces: `pipe` named mesh; `userData.time`

- [ ] **Step 1: Update NEON_PIPE factory in `src/obstacle-types.js`**

Replace the entire `NEON_PIPE()` factory:

```js
NEON_PIPE() {
  const group = new THREE.Group()
  const geo = new THREE.CylinderGeometry(0.15, 0.15, 2.6, 8)
  geo.rotateZ(Math.PI / 2)
  const pipe = new THREE.Mesh(geo, emissiveMat(0x004444, 0x00ffff))
  pipe.position.y = 1.2
  pipe.name = 'pipe'
  group.add(pipe)
  // End caps
  const capMat = emissiveMat(0x006666, 0x00ffff, 3)
  ;[-1.3, 1.3].forEach(x => {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 12), capMat)
    cap.rotation.z = Math.PI / 2
    cap.position.set(x, 1.2, 0)
    group.add(cap)
  })
  // Support brackets
  const bracketMat = emissiveMat(0x003333, 0x006666, 1)
  ;[-0.8, 0.8].forEach(x => {
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), bracketMat)
    bracket.position.set(x, 1.7, 0)
    group.add(bracket)
  })
  group.userData.type = 'NEON_PIPE'
  group.userData.avoidWith = 'SLIDE'
  group.userData.time = 0
  group.userData.hazardAABB = { minX: -1.3, maxX: 1.3, minY: 0.95, maxY: 1.45, minZ: -0.15, maxZ: 0.15 }
  return group
},
```

- [ ] **Step 2: Add time reset in `spawnOne()` in `src/obstacles.js`**

```js
if (entry.obj.userData.type === 'NEON_PIPE') {
  entry.obj.userData.time = 0
}
```

- [ ] **Step 3: Add pulse animation in `update()` in `src/obstacles.js`**

Inside `pool.forEach`, add:

```js
if (obj.userData.type === 'NEON_PIPE') {
  obj.userData.time += delta
  const pipe = obj.getObjectByName('pipe')
  if (pipe) pipe.material.emissiveIntensity = 1.5 + 0.8 * Math.sin(obj.userData.time * 4)
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```
Expected: all tests pass.

- [ ] **Step 5: Visual verify**

Play until NEON_PIPE spawns. Verify: brighter glowing end caps on both sides, two thin bracket supports above the pipe, pipe brightness pulses rhythmically.

- [ ] **Step 6: Commit**

```bash
git add src/obstacle-types.js src/obstacles.js
git commit -m "feat: NEON_PIPE end caps, support brackets, pulse animation"
```

---

### Task 4: GAP — pulsing edges, danger cross

**Files:**
- Modify: `src/obstacle-types.js` (GAP factory)
- Modify: `src/obstacles.js` (spawnOne reset + update loop)

**Interfaces:**
- Produces: `gapEdge` named mesh (first edge strip, material shared with all strips); `userData.time`

- [ ] **Step 1: Update GAP factory in `src/obstacle-types.js`**

Replace the entire `GAP()` factory:

```js
GAP() {
  const group = new THREE.Group()
  // Dark void floor
  const geo = new THREE.PlaneGeometry(2.4, 3)
  geo.rotateX(-Math.PI / 2)
  const floor = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x000000 }))
  floor.position.y = -0.05
  group.add(floor)
  // Pulsing warning edges (all share edgeMat so one material update affects all)
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
  // Danger cross markers
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
},
```

- [ ] **Step 2: Add time reset in `spawnOne()` in `src/obstacles.js`**

```js
if (entry.obj.userData.type === 'GAP') {
  entry.obj.userData.time = 0
}
```

- [ ] **Step 3: Add pulse animation in `update()` in `src/obstacles.js`**

Inside `pool.forEach`, add:

```js
if (obj.userData.type === 'GAP') {
  obj.userData.time += delta
  const gapEdge = obj.getObjectByName('gapEdge')
  if (gapEdge) gapEdge.material.emissiveIntensity = 4 + 2 * Math.abs(Math.sin(obj.userData.time * 3))
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```
Expected: all tests pass.

- [ ] **Step 5: Visual verify**

Play until GAP spawns. Verify: bright orange pulsing edge strips, red × cross pattern visible on the void surface, edges clearly mark the gap boundaries.

- [ ] **Step 6: Commit**

```bash
git add src/obstacle-types.js src/obstacles.js
git commit -m "feat: GAP pulsing edges, danger cross markers"
```

---

### Task 5: LASER_GATE — segmented posts, crossbar, dual beam

**Files:**
- Modify: `src/obstacle-types.js` (LASER_GATE factory)
- Modify: `src/obstacles.js` (update loop for beam2)

**Interfaces:**
- Produces: `beam` (existing), `beam2` (new, opposite-phase blink) named meshes; AABB updated to cover both beams

- [ ] **Step 1: Update LASER_GATE factory in `src/obstacle-types.js`**

Replace the entire `LASER_GATE()` factory:

```js
LASER_GATE() {
  const group = new THREE.Group()
  // Segmented posts (3 parts each)
  ;[-1.1, 1.1].forEach(x => {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 0.14), emissiveMat(0x440000, 0xff0000, 2))
    base.position.set(x, 0.15, 0)
    const mid = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.8, 0.08), emissiveMat(0x440000, 0xff0000, 2))
    mid.position.set(x, 1.05, 0)
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 0.14), emissiveMat(0x440000, 0xff0000, 2))
    top.position.set(x, 1.95, 0)
    group.add(base, mid, top)
  })
  // Top crossbar
  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.08), emissiveMat(0x440000, 0xff0000, 2))
  crossbar.position.y = 2.1
  group.add(crossbar)
  // Primary beam
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.06), emissiveMat(0x440000, 0xff0000, 3))
  beam.position.y = 1.2
  beam.name = 'beam'
  group.add(beam)
  // Secondary beam (opposite-phase blink)
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
},
```

- [ ] **Step 2: Add beam2 toggle in `update()` in `src/obstacles.js`**

Replace the existing LASER_GATE block:

```js
if (obj.userData.type === 'LASER_GATE') {
  obj.userData.blinkTimer += delta
  const beam = obj.getObjectByName('beam')
  const beam2 = obj.getObjectByName('beam2')
  if (beam) beam.visible = Math.sin(obj.userData.blinkTimer * 6) > 0
  if (beam2) beam2.visible = beam ? !beam.visible : false
}
```

- [ ] **Step 3: Run tests**

```bash
npm test
```
Expected: all tests pass. Note: `collision.test.js` tests `fbb3180`-era `beam.visible` logic via `boxesOverlap` — beam visibility check is in `main.js` not collision.js, so tests still pass.

- [ ] **Step 4: Visual verify**

Play until LASER_GATE spawns. Verify: segmented posts with thicker caps at base and top, crossbar connecting post tops, two beams alternating — when primary beam is on, secondary is off and vice versa.

- [ ] **Step 5: Commit**

```bash
git add src/obstacle-types.js src/obstacles.js
git commit -m "feat: LASER_GATE segmented posts, crossbar, dual alternating beams"
```

---

### Task 6: SHARD — inner core, multi-axis rotation

**Files:**
- Modify: `src/collectibles.js` (`makeShardMesh` + `update()`)

**Interfaces:**
- `makeShardMesh` still returns a `THREE.Mesh` (outer shell) with inner core as a child mesh. Pool usage unchanged.

- [ ] **Step 1: Update `makeShardMesh` in `src/collectibles.js`**

Replace the entire `makeShardMesh` function:

```js
function makeShardMesh(isEven) {
  const geo = new THREE.OctahedronGeometry(0.25)
  const mat = new THREE.MeshStandardMaterial({
    color: isEven ? 0x004444 : 0x440044,
    emissive: isEven ? 0x00ffff : 0xff00ff,
    emissiveIntensity: 2,
    roughness: 0.2, metalness: 0.8,
  })
  const mesh = new THREE.Mesh(geo, mat)
  // Inner core
  const coreMat = new THREE.MeshStandardMaterial({
    color: isEven ? 0x00ffff : 0xff00ff,
    emissive: isEven ? 0x00ffff : 0xff00ff,
    emissiveIntensity: 4,
    roughness: 0, metalness: 1,
  })
  mesh.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.12), coreMat))
  return mesh
}
```

- [ ] **Step 2: Add multi-axis rotation in `update()` in `src/collectibles.js`**

Find the line `mesh.rotation.y += delta * 2` inside `pool.forEach`. Replace it with type-aware rotation:

```js
if (mesh.userData.type === 'SHARD') {
  mesh.rotation.y += delta * 2
  mesh.rotation.x += delta * 1.3
} else {
  mesh.rotation.y += delta * 2
}
```

(Power-up rotation will be enhanced in Task 7; this just preserves the existing behavior for now while enabling multi-axis for shards.)

- [ ] **Step 3: Run tests**

```bash
npm test
```
Expected: all tests pass.

- [ ] **Step 4: Visual verify**

Play and collect shards. Verify: each shard has a bright inner core visible through the outer shell, rotation is on two axes giving tumbling appearance.

- [ ] **Step 5: Commit**

```bash
git add src/collectibles.js
git commit -m "feat: SHARD inner core, multi-axis tumbling rotation"
```

---

### Task 7: Power-ups — distinct shapes, bob animation

**Files:**
- Modify: `src/collectibles.js` (`makePowerUpMesh` + `spawnPowerUp` + `update()`)

**Interfaces:**
- `makePowerUpMesh` now returns a `THREE.Group` (not Mesh) for all types. Pool `mesh` field holds Group — Three.js Group supports `.position`, `.rotation`, `.visible`, `setFromObject`, so pool and AABB logic unchanged.
- `userData.time = 0` reset at spawn in `spawnPowerUp`.

- [ ] **Step 1: Replace `makePowerUpMesh` in `src/collectibles.js`**

Replace the entire `makePowerUpMesh` function:

```js
function makePowerUpMesh(type) {
  const c = POWERUP_COLORS[type]
  const group = new THREE.Group()
  const stdMat = (color, emissive, intensity = 2.5) => new THREE.MeshStandardMaterial({
    color, emissive, emissiveIntensity: intensity, roughness: 0.2, metalness: 0.9,
  })
  if (type === 'SHIELD') {
    group.add(new THREE.Mesh(
      new THREE.TorusGeometry(0.35, 0.08, 8, 16),
      stdMat(c.color, c.emissive)
    ))
  } else if (type === 'MAGNET') {
    const cylGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8)
    const north = new THREE.Mesh(cylGeo, stdMat(0xff2200, 0xff2200, 2))
    north.position.x = -0.12
    const south = new THREE.Mesh(cylGeo, stdMat(0x2200ff, 0x4444ff, 2))
    south.position.x = 0.12
    group.add(north, south)
  } else if (type === 'OVERDRIVE') {
    group.add(new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.4),
      stdMat(c.color, c.emissive, 3)
    ))
  } else if (type === 'HOVER') {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.4), stdMat(c.color, c.emissive))
    m.scale.y = 0.5
    group.add(m)
  }
  group.userData.isPowerUp = true
  group.userData.powerUpType = type
  group.userData.time = 0
  return group
}
```

- [ ] **Step 2: Reset `userData.time` at spawn in `spawnPowerUp()`**

In `spawnPowerUp()`, after `entry.mesh.position.set(...)`, add:

```js
entry.mesh.userData.time = 0
```

- [ ] **Step 3: Update the rotation/bob block in `update()` in `src/collectibles.js`**

The existing code has `mesh.rotation.y += delta * 2` inside the type-aware block from Task 6. Replace the entire rotation section (the if/else from Task 6 and any `mesh.rotation.y` line) with:

```js
if (mesh.userData.type === 'SHARD') {
  mesh.rotation.y += delta * 2
  mesh.rotation.x += delta * 1.3
} else {
  // Power-up: bob + type-specific spin
  mesh.userData.time = (mesh.userData.time || 0) + delta
  mesh.position.y = 0.8 + 0.15 * Math.sin(mesh.userData.time * 3)
  switch (mesh.userData.type) {
    case 'SHIELD':    mesh.rotation.y += delta * 1.5; mesh.rotation.x += delta * 1.2; break
    case 'MAGNET':    mesh.rotation.y += delta * 2; break
    case 'OVERDRIVE': mesh.rotation.y += delta * 6; break
    case 'HOVER':     mesh.rotation.y += delta * 2; break
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```
Expected: all tests pass.

- [ ] **Step 5: Visual verify**

Play until all 4 power-up types spawn. Verify:
- SHIELD: blue torus ring, spinning on two axes
- MAGNET: red + blue dual cylinder bars, slow rotation
- OVERDRIVE: white icosahedron, fast spin
- HOVER: flat green gem (squished octahedron), gentle bob
- All power-ups float up and down gently

- [ ] **Step 6: Commit**

```bash
git add src/collectibles.js
git commit -m "feat: power-ups distinct shapes (torus/dual-cyl/icosahedron/gem), bob animation"
```

---

### Task 8: Player — visor, shield bubble, arm swing

**Files:**
- Modify: `src/player.js` (`buildHumanoid` + `update()`)

**Interfaces:**
- Produces: `shieldBubble` named mesh (child of group, visible only when SHIELD active)
- AABB unchanged: `±0.28 / h:1.8 or 0.9`

- [ ] **Step 1: Add visor and shield bubble to `buildHumanoid` in `src/player.js`**

After the `head` mesh definition (line ~17), add the visor as a child of head:

```js
const visor = new THREE.Mesh(
  new THREE.BoxGeometry(0.35, 0.08, 0.05),
  new THREE.MeshStandardMaterial({
    color: colors.emissive,
    emissive: colors.emissive,
    emissiveIntensity: 3,
    roughness: 0,
    metalness: 1,
  })
)
visor.position.set(0, -0.04, 0.22)
visor.name = 'visor'
head.add(visor)
```

After the `group.add(head, torso, lArm, rArm, lLeg, rLeg)` line, add the shield bubble:

```js
const bubble = new THREE.Mesh(
  new THREE.SphereGeometry(0.9, 12, 12),
  new THREE.MeshStandardMaterial({
    color: 0x0044ff,
    emissive: 0x0088ff,
    emissiveIntensity: 1,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
  })
)
bubble.position.y = 0.9
bubble.name = 'shieldBubble'
bubble.visible = false
group.add(bubble)
```

- [ ] **Step 2: Add arm swing and shield bubble update in `update()` in `src/player.js`**

Replace the existing `// --- Leg animation ---` block:

```js
// --- Leg animation + arm swing ---
if (gs.status === 'PLAYING') {
  legAngle += delta * 8
  const lLeg = group.getObjectByName('lLeg')
  const rLeg = group.getObjectByName('rLeg')
  const lArm = group.getObjectByName('lArm')
  const rArm = group.getObjectByName('rArm')
  if (lLeg && rLeg) {
    lLeg.rotation.x = Math.sin(legAngle) * 0.5
    rLeg.rotation.x = -Math.sin(legAngle) * 0.5
  }
  if (lArm && rArm) {
    if (p.action === 'SLIDING') {
      lArm.rotation.x = -0.8
      rArm.rotation.x = -0.8
    } else {
      lArm.rotation.x = Math.sin(legAngle) * 0.4
      rArm.rotation.x = -Math.sin(legAngle) * 0.4
    }
  }
}
// --- Shield bubble ---
const bubble = group.getObjectByName('shieldBubble')
if (bubble) bubble.visible = gs.powerUp?.type === 'SHIELD'
```

- [ ] **Step 3: Run tests**

```bash
npm test
```
Expected: all tests pass.

- [ ] **Step 4: Visual verify**

Run the game. Verify:
- Player has a bright visor strip across the front of the head
- Arms swing opposite to legs while running
- Arms reach forward during slide
- Collect SHIELD power-up: translucent blue bubble sphere surrounds player, disappears when SHIELD consumed by hit or game reset

- [ ] **Step 5: Commit**

```bash
git add src/player.js
git commit -m "feat: player visor, SHIELD bubble, arm swing + slide pose"
```

---

## Self-Review Checklist

- [x] PATROL_BOT: eyes, antenna, bob, lean ✓
- [x] HOLOGRAM_SIGN: frame, text lines, flicker, glitch ✓
- [x] NEON_PIPE: end caps, brackets, pulse ✓
- [x] GAP: pulsing edges, danger cross ✓
- [x] LASER_GATE: segmented posts, crossbar, dual beam ✓
- [x] SHARD: inner core, multi-axis rotation ✓
- [x] Power-ups: SHIELD torus, MAGNET dual-cyl, OVERDRIVE icosahedron, HOVER flat gem, bob ✓
- [x] Player: visor, shield bubble, arm swing, slide pose ✓
- [x] No placeholders, no TBDs ✓
- [x] `userData.time` initialized in factory and reset in spawnOne/spawnPowerUp ✓
- [x] AABB unchanged for player; updated for PATROL_BOT (antenna) and LASER_GATE (dual beam) ✓
- [x] `npm test` step in every task ✓
