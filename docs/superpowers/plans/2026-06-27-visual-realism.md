# Visual Realism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Neon Runner's visual fidelity with bloom post-processing, realistic materials, envMap reflections, and lightweight track structures — while preserving the cyberpunk neon aesthetic.

**Architecture:** All changes in `src/main.js` (renderer pipeline, envMap, fog/ambient) and `src/scene.js` (floor, buildings, rails, arches, lighting). No other modules touched. Visual-only additions have no AABB — collision system unchanged.

**Tech Stack:** Three.js r165, `three/addons/postprocessing/EffectComposer`, `three/addons/postprocessing/UnrealBloomPass`, `three/addons/environments/RoomEnvironment`

## Global Constraints

- Import addon paths use `three/addons/...` (maps to `three/examples/jsm/...` via package exports)
- No changes to `src/collision.js`, `src/player.js`, `src/obstacle-types.js`, `src/constants.js`, or any non-scene module
- No custom GLSL shaders — Three.js built-ins only
- All new track geometry is visual-only (no AABB, no collision)
- `npm test` must pass after every task

---

### Task 1: Renderer pipeline — tone mapping, shadows, bloom

**Files:**
- Modify: `src/main.js`

**Interfaces:**
- Produces: `composer` (EffectComposer) used in render loop instead of `renderer.render()`

- [ ] **Step 1: Add imports at top of main.js**

Add after the existing `import * as THREE from 'three'` line:

```js
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
```

- [ ] **Step 2: Configure renderer after existing renderer setup**

After `renderer.setPixelRatio(...)`, add:

```js
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.2
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
```

- [ ] **Step 3: Create composer after scene and camera are defined**

After the `camera.lookAt(...)` line, add:

```js
const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
composer.addPass(new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.8,   // strength
  0.6,   // radius
  0.35   // threshold — emissiveIntensity > ~1 will glow
))
```

- [ ] **Step 4: Update resize handler to resize composer**

The existing resize handler ends with `renderer.setSize(...)`. Add after it:

```js
composer.setSize(window.innerWidth, window.innerHeight)
```

- [ ] **Step 5: Replace renderer.render with composer.render**

Find `renderer.render(scene, camera)` at the bottom of the animation loop (line ~228). Replace with:

```js
composer.render()
```

- [ ] **Step 6: Run dev server and verify bloom**

```bash
npm run dev
```

Open http://localhost:3000. Expected: emissive neon elements (obstacle beams, shard collectibles, drone) now have a visible soft glow halo. Overall image should look more cinematic/filmic — slightly warmer tone mapping. If everything is white/overblown, reduce `toneMappingExposure` to `0.9`.

- [ ] **Step 7: Run tests**

```bash
npm test
```

Expected: all tests pass (no visual code in test suite).

- [ ] **Step 8: Commit**

```bash
git add src/main.js
git commit -m "feat: bloom post-processing + ACES tone mapping + shadow maps"
```

---

### Task 2: envMap + fog and ambient tweaks

**Files:**
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `renderer`, `scene` from Task 1
- Produces: `scene.environment` set — all MeshStandardMaterial in scene get automatic env reflections

- [ ] **Step 1: Add imports**

Add after the bloom imports from Task 1:

```js
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
```

- [ ] **Step 2: Set up envMap after composer creation**

Add after the `composer.addPass(new UnrealBloomPass(...))` block:

```js
const pmrem = new THREE.PMREMGenerator(renderer)
scene.environment = pmrem.fromScene(new RoomEnvironment()).texture
pmrem.dispose()
```

- [ ] **Step 3: Tweak existing fog**

Find `scene.fog = new THREE.FogExp2(0x110022, 0.018)` (around line 22). Change to:

```js
scene.fog = new THREE.FogExp2(0x0a0018, 0.008)
```

Reason: lower density so distant buildings remain partially visible; darker color matches scene background.

- [ ] **Step 4: Tweak existing ambient light**

Find `scene.add(new THREE.AmbientLight(0x221133, 2))` (around line 23). Change to:

```js
scene.add(new THREE.AmbientLight(0x110022, 0.4))
```

Reason: ambient was too bright (intensity 2), washing out the contrast that makes neon pop. Low-intensity cool purple lifts black shadows without competing with neon lights.

- [ ] **Step 5: Run dev server and verify**

```bash
npm run dev
```

Expected: metallic surfaces on player and obstacles show subtle environment reflections. Fog is less thick — distant skyline and buildings visible at ~60% opacity. Shadow areas are dark purple rather than pure black.

- [ ] **Step 6: Run tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/main.js
git commit -m "feat: envMap reflections, fog density tuned, ambient light lowered"
```

---

### Task 3: Lighting — shadows + camera-following point lights

**Files:**
- Modify: `src/scene.js`
- Modify: `src/main.js` (updateScene call sites)

**Interfaces:**
- Consumes: `updateScene` currently has signature `(delta, speed)`
- Produces: `updateScene(delta, speed, cameraZ)` — point lights track camera Z so they always flank the player

- [ ] **Step 1: Enable shadow on directional light in scene.js**

Find `dirLight.position.set(5, 10, 5)` in `initScene`. After it, add:

```js
dirLight.castShadow = true
dirLight.shadow.mapSize.width = 1024
dirLight.shadow.mapSize.height = 1024
dirLight.shadow.camera.near = 0.5
dirLight.shadow.camera.far = 50
dirLight.shadow.camera.left = -10
dirLight.shadow.camera.right = 10
dirLight.shadow.camera.top = 10
dirLight.shadow.camera.bottom = -10
```

- [ ] **Step 2: Update updateScene signature to accept cameraZ**

Find `function updateScene(delta, speed) {` inside `initScene`. Change to:

```js
function updateScene(delta, speed, cameraZ = 0) {
```

- [ ] **Step 3: Add point light camera tracking inside updateScene**

The `pointLeft` and `pointRight` variables are already in closure scope of `updateScene`. Add at the top of the `updateScene` function body:

```js
pointLeft.position.z = cameraZ
pointRight.position.z = cameraZ
```

- [ ] **Step 4: Update updateScene call sites in main.js**

There are two calls to `updateScene` in `main.js`:

1. In the PLAYING branch (~line 136): `updateScene(delta, gameState.speed)` → change to:
```js
updateScene(delta, gameState.speed, camera.position.z)
```

2. In the TITLE branch (~line 225): `updateScene(delta, 4)` → change to:
```js
updateScene(delta, 4, camera.position.z)
```

- [ ] **Step 5: Run dev server and verify**

```bash
npm run dev
```

Expected: player and obstacles cast soft shadows on the floor. Neon point lights (cyan left, magenta right) illuminate the track at the player's current Z position throughout the run — no longer fade out as you progress forward.

- [ ] **Step 6: Run tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/scene.js src/main.js
git commit -m "feat: directional light shadows, point lights follow camera Z"
```

---

### Task 4: Floor material — wet reflective asphalt

**Files:**
- Modify: `src/scene.js`

**Interfaces:**
- Consumes: `scene.environment` from Task 2 (envMap applied automatically to MeshStandardMaterial)
- Produces: reflective floor tiles with `receiveShadow = true`

- [ ] **Step 1: Update makeGroundMaterial roughness and metalness**

Find the `return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.1 })` line in `makeGroundMaterial()`. Replace with:

```js
return new THREE.MeshStandardMaterial({
  map: tex,
  roughness: 0.15,
  metalness: 0.5,
  envMapIntensity: 1.0,
})
```

- [ ] **Step 2: Improve canvas texture**

In `makeGroundMaterial()`, find and replace the texture drawing section. The current grid uses `#220044` for lines and `#004444` for lane dividers. Replace the entire canvas drawing block (after `ctx.fillRect(0, 0, size, size)`) with:

```js
// Grid lines
ctx.strokeStyle = '#0044aa'
ctx.lineWidth = 1
const step = size / 8
for (let i = 0; i <= 8; i++) {
  ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, size); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(0, i * step); ctx.lineTo(size, i * step); ctx.stroke()
}
// Speed stripes (thin center verticals)
ctx.strokeStyle = '#001133'
ctx.lineWidth = 8
;[size * 0.45, size * 0.55].forEach(x => {
  ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke()
})
// Lane dividers
ctx.strokeStyle = '#00aaaa'
ctx.lineWidth = 3
;[size * (3 / 8), size * (5 / 8)].forEach(x => {
  ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke()
})
```

- [ ] **Step 3: Enable receiveShadow on floor tiles**

In the ground tile creation loop in `initScene`:

```js
for (let i = 0; i < TILE_COUNT; i++) {
  const tile = new THREE.Mesh(groundGeo, groundMat)
  tile.position.z = -i * TILE_LENGTH
  tile.receiveShadow = true   // add this line
  groundGroup.add(tile)
}
```

- [ ] **Step 4: Run dev server and verify**

```bash
npm run dev
```

Expected: floor looks darker and more reflective. Neon colors from point lights and emissive obstacles create subtle colored reflections in the floor surface. Shadows from player and obstacles visible on floor.

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/scene.js
git commit -m "feat: reflective floor material with improved grid texture and shadows"
```

---

### Task 5: Building variety with neon window strips

**Files:**
- Modify: `src/scene.js`

**Interfaces:**
- Consumes: nothing new
- Produces: `makeBuildings(scene)` returns `{ dark, bright, windowed, windows }` — 4 InstancedMesh objects used in updateScene parallax

- [ ] **Step 1: Replace makeBuildings with 3-mesh variant**

Replace the entire `makeBuildings(scene)` function with:

```js
function makeBuildings(scene) {
  const geo = new THREE.BoxGeometry(1, 1, 1)
  const spread = 30

  function makeSet(count, color, emissive, emissiveIntensity) {
    const mat = new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity })
    const mesh = new THREE.InstancedMesh(geo, mat, count)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    return mesh
  }

  const dark     = makeSet(36, 0x110022, 0x220033, 0.5)
  const bright   = makeSet(12, 0x1a0033, 0x330055, 0.8)
  const windowed = makeSet(12, 0x110022, 0x220033, 0.5)

  // Window strips: thin emissive panels on building fronts
  const winColors = [0x00ffff, 0xff00ff, 0xffaa00]
  const winGeo = new THREE.BoxGeometry(1, 1, 0.05)
  const winMeshes = winColors.map(c =>
    new THREE.InstancedMesh(
      winGeo,
      new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2 }),
      7  // 7 strips per color = 21 total
    )
  )
  winMeshes.forEach(m => { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage) })

  const dummy = new THREE.Object3D()
  const allSets = [
    { mesh: dark,     count: 36 },
    { mesh: bright,   count: 12 },
    { mesh: windowed, count: 12 },
  ]

  let globalIdx = 0
  allSets.forEach(({ mesh, count }) => {
    for (let i = 0; i < count; i++) {
      const side = globalIdx % 2 === 0 ? 1 : -1
      const w = 2 + Math.random() * 4
      const h = 4 + Math.random() * 20
      const d = 2 + Math.random() * 4
      dummy.position.set(
        side * (8 + Math.random() * spread),
        h / 2 + 0.5,
        -Math.random() * 200
      )
      dummy.scale.set(w, h, d)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      globalIdx++
    }
    mesh.instanceMatrix.needsUpdate = true
    scene.add(mesh)
  })

  // Place window strips on "windowed" buildings
  const windowedPositions = []
  for (let i = 0; i < 12; i++) {
    windowed.getMatrixAt(i, dummy.matrix)
    dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale)
    windowedPositions.push({
      x: dummy.position.x,
      y: dummy.position.y,
      z: dummy.position.z,
      h: dummy.scale.y,
      w: dummy.scale.x,
    })
  }

  winMeshes.forEach((wm, ci) => {
    for (let i = 0; i < 7; i++) {
      const bld = windowedPositions[(ci * 7 + i) % windowedPositions.length]
      dummy.position.set(
        bld.x + (bld.x > 0 ? -bld.w * 0.5 - 0.03 : bld.w * 0.5 + 0.03),
        bld.y + (Math.random() - 0.5) * bld.h * 0.6,
        bld.z
      )
      dummy.scale.set(0.3, bld.h * 0.7, 1)
      dummy.updateMatrix()
      wm.setMatrixAt(i, dummy.matrix)
    }
    wm.instanceMatrix.needsUpdate = true
    scene.add(wm)
  })

  return { dark, bright, windowed, windows: winMeshes }
}
```

- [ ] **Step 2: Update initScene to use new return shape**

Find `const buildingMesh = makeBuildings(scene)` in `initScene`. Change to:

```js
const { dark, bright, windowed, windows } = makeBuildings(scene)
const buildingMeshes = [dark, bright, windowed, ...windows]
```

Remove the line `scene.add(buildingMesh)` (buildings are added inside `makeBuildings` now).

- [ ] **Step 3: Update parallax scroll in updateScene**

Find the parallax block in `updateScene` that uses `buildingMesh`. Replace with:

```js
buildingMeshes.forEach(mesh => {
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, dummy.matrix)
    dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale)
    dummy.position.z += speed * delta * 0.3
    if (dummy.position.z > 20) dummy.position.z -= 220
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
  }
  mesh.instanceMatrix.needsUpdate = true
})
```

Also remove `buildingMesh.instanceMatrix.needsUpdate = true` if it appears separately.

- [ ] **Step 4: Run dev server and verify**

```bash
npm run dev
```

Expected: buildings have visible variety — some are darker, some are slightly brighter. Colored neon strips (cyan, magenta, amber) appear on building faces and glow via bloom. The city backdrop feels more alive.

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/scene.js
git commit -m "feat: building variety with 3 material types and neon window strips"
```

---

### Task 6: Track structures — side rails and overhead arches

**Files:**
- Modify: `src/scene.js`

**Interfaces:**
- Consumes: `groundGroup` (rails and arches scroll with it via same tile-recycle logic)
- Produces: visual-only neon rail and arch geometry; no collision, no AABB

- [ ] **Step 1: Add makeRails function**

Add this function above `initScene` in `scene.js`:

```js
function makeRails() {
  const group = new THREE.Group()
  const railGeo = new THREE.BoxGeometry(0.06, 0.12, TILE_LENGTH)
  const leftMat = new THREE.MeshStandardMaterial({
    color: 0x004444, emissive: 0x00ffff, emissiveIntensity: 3,
  })
  const rightMat = new THREE.MeshStandardMaterial({
    color: 0x440044, emissive: 0xff00ff, emissiveIntensity: 3,
  })
  for (let i = 0; i < TILE_COUNT; i++) {
    const zPos = -i * TILE_LENGTH
    const left = new THREE.Mesh(railGeo, leftMat)
    left.position.set(-6.2, 0.06, zPos)
    group.add(left)
    const right = new THREE.Mesh(railGeo, rightMat)
    right.position.set(6.2, 0.06, zPos)
    group.add(right)
  }
  return group
}
```

- [ ] **Step 2: Add makeArches function**

Add this function after `makeRails`:

```js
function makeArches() {
  const group = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({
    color: 0x220044, emissive: 0x9900ff, emissiveIntensity: 2,
  })
  const postGeo = new THREE.BoxGeometry(0.08, 3, 0.08)
  const barGeo  = new THREE.BoxGeometry(11, 0.06, 0.06)
  const archSpacing = 20

  for (let i = 0; i < 3; i++) {
    const zPos = -i * archSpacing
    const left  = new THREE.Mesh(postGeo, mat)
    left.position.set(-5.5, 1.5, zPos)
    const right = new THREE.Mesh(postGeo, mat)
    right.position.set(5.5, 1.5, zPos)
    const bar   = new THREE.Mesh(barGeo, mat)
    bar.position.set(0, 3, zPos)
    group.add(left, right, bar)
  }
  return group
}
```

- [ ] **Step 3: Wire rails and arches into initScene**

In `initScene`, after `scene.add(groundGroup)`, add:

```js
const railGroup = makeRails()
scene.add(railGroup)

const archGroup = makeArches()
scene.add(archGroup)
```

- [ ] **Step 4: Add scroll logic for rails and arches in updateScene**

Rails scroll exactly like ground tiles (same speed, same recycle threshold). In `updateScene`, after the ground tile scroll block, add:

```js
// Scroll rails (same cadence as ground tiles)
railGroup.children.forEach(rail => {
  rail.position.z += speed * delta
  if (rail.position.z > TILE_LENGTH) {
    rail.position.z -= TILE_LENGTH * TILE_COUNT
  }
})

// Scroll arches
const archSpacing = 20
const archTotal = archSpacing * 3
archGroup.children.forEach((part, idx) => {
  part.position.z += speed * delta
  // Each arch is 3 parts (left post, right post, bar) — group by arch index
  const archIdx = Math.floor(idx / 3)
  if (part.position.z > archSpacing) {
    part.position.z -= archTotal
  }
})
```

- [ ] **Step 5: Run dev server and verify**

```bash
npm run dev
```

Expected:
- Thin cyan rail on left edge of track, magenta on right — both glow via bloom
- Purple neon arches pass overhead as you run — spaced evenly, no overlap with obstacles
- Rails and arches scroll smoothly and recycle without popping

- [ ] **Step 6: Run tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/scene.js
git commit -m "feat: neon side rails and overhead arch structures on track"
```

---

## Self-Review

**Spec coverage:**
- [x] ACESFilmicToneMapping + exposure → Task 1
- [x] UnrealBloomPass → Task 1
- [x] PCFSoftShadowMap + dirLight.castShadow → Task 3
- [x] AmbientLight tweak → Task 2
- [x] PointLights follow camera Z → Task 3
- [x] updateScene signature cameraZ → Task 3
- [x] Floor roughness 0.15 / metalness 0.5 → Task 4
- [x] Floor receiveShadow → Task 4
- [x] Floor texture improved → Task 4
- [x] envMap (RoomEnvironment + PMREMGenerator) → Task 2
- [x] Fog tuned (0x0a0018, 0.008) → Task 2
- [x] Buildings 3 material types → Task 5
- [x] Window strips InstancedMesh → Task 5
- [x] Side rails cyan/magenta → Task 6
- [x] Overhead arches purple → Task 6
- [x] Arches at y=3 clear of all obstacles → Task 6 (arch bar at y=3, tallest obstacle is PATROL_BOT at ~1.35)

**Placeholder scan:** No TBD, TODO, or vague steps found.

**Type consistency:** `buildingMeshes` array used consistently between Task 5 step 2 (creation) and step 3 (scroll). `railGroup` / `archGroup` created in step 3 and consumed in step 4 — both in same `initScene` closure scope.
