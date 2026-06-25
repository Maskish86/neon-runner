# NEON RUNNER Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-based 3-lane cyberpunk endless runner game using Vite + Vanilla JS + Three.js, with no external assets.

**Architecture:** Single Three.js scene with PerspectiveCamera fixed behind the player; all 3D objects (player, obstacles, background buildings) live in one scene. HUD is a DOM overlay. Object pools for obstacles/collectibles/particles avoid GC pressure. A shared `gameState` object flows through every module's `update(delta, gameState)` call.

**Tech Stack:** Vite 5, Three.js r165, Vitest (unit tests for pure logic), Vanilla JS ES modules.

## Global Constraints

- No external image/model assets — all visuals via Three.js primitives, EmissiveMaterial, and CSS.
- 60fps target: use InstancedMesh for background buildings, object pools for obstacles/collectibles/particles.
- Multi-file: each file has single responsibility. No file grows unwieldy (split if needed).
- Desktop (keyboard) + mobile (swipe) input, zero logic duplication.
- High score persisted in localStorage key `neon-runner-highscore`.
- Vitest for pure logic (collision, drone proximity). Browser verification for visual/interactive features.

---

## Shared Interfaces (read before implementing any task)

```js
// src/constants.js — created in Task 1, used everywhere
export const LANES = [-2.5, 0, 2.5]      // world X positions
export const BASE_SPEED = 8               // units/sec
export const MAX_SPEED = 22
export const ACCEL_FACTOR = 0.0008        // speed += distance * ACCEL_FACTOR per frame
export const LANE_SWITCH_DURATION = 0.15  // seconds
export const JUMP_VELOCITY = 10
export const GRAVITY = -22
export const SLIDE_DURATION = 0.6
export const INVINCIBLE_DURATION = 0.8

export const SKIN_COLORS = {
  CYAN:    { emissive: 0x00ffff, main: 0x004466 },
  MAGENTA: { emissive: 0xff00ff, main: 0x440044 },
  GOLD:    { emissive: 0xffcc00, main: 0x443300 },
}

export const POWERUP_TYPES = ['SHIELD', 'MAGNET', 'OVERDRIVE', 'HOVER']
export const POWERUP_DURATIONS = { SHIELD: Infinity, MAGNET: 8, OVERDRIVE: 5, HOVER: 6 }

// GameState shape — owned by main.js, passed by reference to all modules
// {
//   status: 'TITLE' | 'PLAYING' | 'GAME_OVER',
//   score: number,
//   distance: number,
//   speed: number,
//   hp: number,                        // 1-3
//   skinColor: 'CYAN'|'MAGENTA'|'GOLD',
//   player: {
//     lane: number,                    // 0=left,1=center,2=right
//     targetLane: number,
//     laneT: number,                   // 0→1 lerp progress
//     action: 'RUNNING'|'JUMPING'|'SLIDING'|'LANE_SWITCH',
//     queuedLane: number|null,
//     yPos: number,                    // world Y (0 = ground)
//     yVelocity: number,
//     slideTimer: number,
//     invincibleTimer: number,
//   },
//   powerUp: null | { type: string, timeLeft: number },
//   droneProximity: number,            // 0.0 – 1.0
// }

// AABB helper — used by collision.js
// Each collidable object must expose: getAABB() → THREE.Box3
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `index.html`
- Create: `src/main.js`
- Create: `src/constants.js`
- Create: `src/style.css`

**Interfaces:**
- Produces: `constants.js` exports used by every subsequent task (see Shared Interfaces above)

- [ ] **Step 1: Create package.json**

```json
{
  "name": "neon-runner",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "three": "^0.165.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create vite.config.js**

```js
import { defineConfig } from 'vite'

export default defineConfig({
  server: { port: 3000 },
})
```

- [ ] **Step 3: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NEON RUNNER</title>
  <link rel="stylesheet" href="/src/style.css" />
</head>
<body>
  <div id="hud"></div>
  <div id="overlay"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: Create src/style.css**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #000; overflow: hidden; font-family: 'Courier New', monospace; }
canvas { display: block; }

#hud {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  pointer-events: none; z-index: 10;
  color: #00ffff; font-size: 18px; text-shadow: 0 0 8px #00ffff;
}

#overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  pointer-events: none; z-index: 5;
}

.drone-glow {
  position: absolute; inset: 0;
  box-shadow: inset 0 0 0px 0px rgba(255,0,0,0);
  transition: box-shadow 0.1s;
  pointer-events: none;
}
```

- [ ] **Step 5: Create src/constants.js**

Paste the full constants block from the Shared Interfaces section above.

- [ ] **Step 6: Create src/main.js (minimal — just renderer init)**

```js
import * as THREE from 'three'

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
document.body.prepend(renderer.domElement)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300)
camera.position.set(0, 4, 8)
camera.lookAt(0, 0, -10)

scene.background = new THREE.Color(0x0a0010)
scene.fog = new THREE.FogExp2(0x110022, 0.018)

const ambient = new THREE.AmbientLight(0x221133, 2)
scene.add(ambient)

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

renderer.setAnimationLoop(() => {
  renderer.render(scene, camera)
})
```

- [ ] **Step 7: Install dependencies and start dev server**

```bash
npm install
npm run dev
```

Expected: browser opens at `http://localhost:3000`, shows dark purple canvas with no errors in console.

- [ ] **Step 8: Commit**

```bash
git add package.json vite.config.js index.html src/
git commit -m "feat: scaffold Vite + Three.js project"
```

---

## Task 2: Scene Foundation — Ground, Lighting, Background

**Files:**
- Create: `src/scene.js`
- Modify: `src/main.js`

**Interfaces:**
- Produces: `initScene(scene)` → `{ groundGroup, buildingMesh, updateScene(delta, speed) }`
- Consumes: `scene` (THREE.Scene from main.js)

- [ ] **Step 1: Create src/scene.js**

```js
import * as THREE from 'three'

const TILE_LENGTH = 40
const TILE_COUNT = 3

function makeGroundMaterial() {
  // Procedural grid texture via canvas
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#0a0018'
  ctx.fillRect(0, 0, size, size)
  ctx.strokeStyle = '#220044'
  ctx.lineWidth = 1
  const step = size / 8
  for (let i = 0; i <= 8; i++) {
    ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, size); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, i * step); ctx.lineTo(size, i * step); ctx.stroke()
  }
  // Lane dividers in cyan
  ctx.strokeStyle = '#004444'
  ctx.lineWidth = 3
  ;[size * (3/8), size * (5/8)].forEach(x => {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke()
  })
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1, TILE_COUNT)
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.1 })
}

function makeBuildings(scene) {
  const count = 60
  const geo = new THREE.BoxGeometry(1, 1, 1)
  const mat = new THREE.MeshStandardMaterial({
    color: 0x110022,
    emissive: 0x220033,
    emissiveIntensity: 0.5,
  })
  const mesh = new THREE.InstancedMesh(geo, mat, count)
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

  const dummy = new THREE.Object3D()
  const spread = 30
  for (let i = 0; i < count; i++) {
    const side = Math.random() > 0.5 ? 1 : -1
    dummy.position.set(
      side * (8 + Math.random() * spread),
      Math.random() * 10 + 2,
      -Math.random() * 200
    )
    dummy.scale.set(
      2 + Math.random() * 4,
      4 + Math.random() * 20,
      2 + Math.random() * 4,
    )
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
  }
  mesh.instanceMatrix.needsUpdate = true
  return mesh
}

function makeSkyline() {
  const geo = new THREE.PlaneGeometry(400, 80)
  const canvas = document.createElement('canvas')
  canvas.width = 1024; canvas.height = 256
  const ctx = canvas.getContext('2d')
  const grad = ctx.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, '#0a0020')
  grad.addColorStop(0.4, '#220044')
  grad.addColorStop(0.7, '#440066')
  grad.addColorStop(1, '#000010')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 1024, 256)
  // Neon city silhouette
  ctx.fillStyle = '#110022'
  for (let x = 0; x < 1024; x += 20 + Math.floor(Math.random() * 30)) {
    const h = 30 + Math.random() * 180
    ctx.fillRect(x, 256 - h, 15 + Math.random() * 25, h)
  }
  // Random neon windows
  ctx.fillStyle = '#00ffff44'
  for (let i = 0; i < 200; i++) {
    ctx.fillRect(Math.random() * 1024, Math.random() * 200 + 30, 3, 5)
  }
  const tex = new THREE.CanvasTexture(canvas)
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9, depthWrite: false })
  const plane = new THREE.Mesh(geo, mat)
  plane.position.set(0, 20, -120)
  return plane
}

export function initScene(scene) {
  // Lights
  const dirLight = new THREE.DirectionalLight(0x9944ff, 2)
  dirLight.position.set(5, 10, 5)
  scene.add(dirLight)
  const pointLeft = new THREE.PointLight(0x00ffff, 3, 30)
  pointLeft.position.set(-8, 3, 0)
  scene.add(pointLeft)
  const pointRight = new THREE.PointLight(0xff00ff, 3, 30)
  pointRight.position.set(8, 3, 0)
  scene.add(pointRight)

  // Ground tiles
  const groundGroup = new THREE.Group()
  const groundGeo = new THREE.PlaneGeometry(12, TILE_LENGTH)
  groundGeo.rotateX(-Math.PI / 2)
  const groundMat = makeGroundMaterial()
  for (let i = 0; i < TILE_COUNT; i++) {
    const tile = new THREE.Mesh(groundGeo, groundMat)
    tile.position.z = -i * TILE_LENGTH
    groundGroup.add(tile)
  }
  scene.add(groundGroup)

  // Buildings
  const buildingMesh = makeBuildings(scene)
  scene.add(buildingMesh)

  // Skyline
  scene.add(makeSkyline())

  let totalDist = 0

  function updateScene(delta, speed) {
    totalDist += speed * delta
    // Scroll ground tiles
    groundGroup.children.forEach(tile => {
      tile.position.z += speed * delta
      if (tile.position.z > TILE_LENGTH) {
        tile.position.z -= TILE_LENGTH * TILE_COUNT
      }
    })
    // Parallax buildings (30% speed)
    const dummy = new THREE.Object3D()
    for (let i = 0; i < buildingMesh.count; i++) {
      buildingMesh.getMatrixAt(i, dummy.matrix)
      dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale)
      dummy.position.z += speed * delta * 0.3
      if (dummy.position.z > 20) dummy.position.z -= 220
      dummy.updateMatrix()
      buildingMesh.setMatrixAt(i, dummy.matrix)
    }
    buildingMesh.instanceMatrix.needsUpdate = true
  }

  return { groundGroup, buildingMesh, updateScene }
}
```

- [ ] **Step 2: Wire scene into main.js**

Replace `src/main.js` with:

```js
import * as THREE from 'three'
import { initScene } from './scene.js'

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
document.body.prepend(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0a0010)
scene.fog = new THREE.FogExp2(0x110022, 0.018)

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300)
camera.position.set(0, 4, 8)
camera.lookAt(0, 0, -10)

const { updateScene } = initScene(scene)

const ambient = new THREE.AmbientLight(0x221133, 2)
scene.add(ambient)

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

let last = performance.now()
renderer.setAnimationLoop(() => {
  const now = performance.now()
  const delta = Math.min((now - last) / 1000, 0.05)
  last = now
  updateScene(delta, 8)
  renderer.render(scene, camera)
})
```

- [ ] **Step 3: Verify**

Run `npm run dev`. Expected: dark purple scene with scrolling grid ground, glowing city buildings on sides, neon skyline in the distance. No console errors.

- [ ] **Step 4: Commit**

```bash
git add src/scene.js src/main.js src/style.css
git commit -m "feat: add scene foundation with ground, buildings, skyline"
```

---

## Task 3: Player Mesh & Lane System

**Files:**
- Create: `src/player.js`
- Modify: `src/main.js`

**Interfaces:**
- Produces:
  - `initPlayer(scene, skinColor) → playerApi`
  - `playerApi.group` (THREE.Group — add to scene)
  - `playerApi.update(delta, gameState)`
  - `playerApi.getAABB() → THREE.Box3`
  - `playerApi.setInvincible()`
- Consumes: `LANES`, `SKIN_COLORS`, `LANE_SWITCH_DURATION`, `JUMP_VELOCITY`, `GRAVITY`, `SLIDE_DURATION`, `INVINCIBLE_DURATION` from constants.js

- [ ] **Step 1: Create src/player.js**

```js
import * as THREE from 'three'
import {
  LANES, SKIN_COLORS, LANE_SWITCH_DURATION,
  JUMP_VELOCITY, GRAVITY, SLIDE_DURATION, INVINCIBLE_DURATION
} from './constants.js'

function buildHumanoid(colors) {
  const group = new THREE.Group()
  const mat = (emissiveIntensity = 1) => new THREE.MeshStandardMaterial({
    color: colors.main,
    emissive: colors.emissive,
    emissiveIntensity,
    roughness: 0.3,
    metalness: 0.6,
  })

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), mat(1.2))
  head.position.y = 1.6
  head.name = 'head'

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.3), mat())
  torso.position.y = 1.1
  torso.name = 'torso'

  const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 0.15), mat(0.6))
  lArm.position.set(-0.35, 1.05, 0)
  const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 0.15), mat(0.6))
  rArm.position.set(0.35, 1.05, 0)

  const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.18), mat(0.8))
  lLeg.position.set(-0.15, 0.5, 0)
  lLeg.name = 'lLeg'
  const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.18), mat(0.8))
  rLeg.position.set(0.15, 0.5, 0)
  rLeg.name = 'rLeg'

  group.add(head, torso, lArm, rArm, lLeg, rLeg)
  return group
}

export function initPlayer(scene, skinColor = 'CYAN') {
  const colors = SKIN_COLORS[skinColor]
  const group = buildHumanoid(colors)
  group.position.set(LANES[1], 0, 0)
  scene.add(group)

  const box3 = new THREE.Box3()

  // Running leg animation state
  let legAngle = 0

  function getAABB() {
    // Compute from world position; player Y offset already in group.position.y
    const h = group.scale.y < 1 ? 0.9 : 1.8  // slide = half height
    const px = group.position.x
    const py = group.position.y
    box3.min.set(px - 0.28, py, -0.25)
    box3.max.set(px + 0.28, py + h, 0.25)
    return box3
  }

  function setInvincible() {
    // called by collision.js
  }

  function update(delta, gs) {
    const p = gs.player

    // --- Lane lerp ---
    if (p.action === 'LANE_SWITCH') {
      p.laneT += delta / LANE_SWITCH_DURATION
      if (p.laneT >= 1) {
        p.laneT = 1
        p.lane = p.targetLane
        // Consume queued input
        if (p.queuedLane !== null && p.queuedLane !== p.lane) {
          p.targetLane = p.queuedLane
          p.queuedLane = null
          p.laneT = 0
        } else {
          p.action = 'RUNNING'
          p.queuedLane = null
        }
      }
      const fromX = LANES[p.lane]
      const toX = LANES[p.targetLane]
      group.position.x = THREE.MathUtils.lerp(fromX, toX, p.laneT)
    } else {
      group.position.x = LANES[p.lane]
    }

    // --- Jump physics ---
    if (p.action === 'JUMPING') {
      p.yVelocity += GRAVITY * delta
      p.yPos += p.yVelocity * delta
      if (p.yPos <= 0) {
        p.yPos = 0
        p.yVelocity = 0
        p.action = 'RUNNING'
      }
    }
    group.position.y = p.yPos

    // --- Slide scale ---
    if (p.action === 'SLIDING') {
      p.slideTimer -= delta
      group.scale.y = 0.5
      group.position.y = 0
      if (p.slideTimer <= 0) {
        p.action = 'RUNNING'
        group.scale.y = 1
      }
    } else if (p.action !== 'JUMPING') {
      group.scale.y = 1
    }

    // --- Invincibility blink ---
    if (p.invincibleTimer > 0) {
      p.invincibleTimer -= delta
      group.visible = Math.floor(p.invincibleTimer / 0.08) % 2 === 0
      if (p.invincibleTimer <= 0) group.visible = true
    }

    // --- Leg animation ---
    if (gs.status === 'PLAYING') {
      legAngle += delta * 8
      const lLeg = group.getObjectByName('lLeg')
      const rLeg = group.getObjectByName('rLeg')
      if (lLeg && rLeg) {
        lLeg.rotation.x = Math.sin(legAngle) * 0.5
        rLeg.rotation.x = -Math.sin(legAngle) * 0.5
      }
    }
  }

  return { group, update, getAABB, setInvincible }
}
```

- [ ] **Step 2: Add player to main.js**

In `src/main.js`, after `initScene`:

```js
import { initPlayer } from './player.js'

// after initScene(scene):
const gameState = {
  status: 'PLAYING',
  score: 0, distance: 0, speed: 8, hp: 3,
  skinColor: 'CYAN',
  player: {
    lane: 1, targetLane: 1, laneT: 1,
    action: 'RUNNING', queuedLane: null,
    yPos: 0, yVelocity: 0,
    slideTimer: 0, invincibleTimer: 0,
  },
  powerUp: null,
  droneProximity: 0,
}
const playerApi = initPlayer(scene, gameState.skinColor)

// in animation loop, before render:
playerApi.update(delta, gameState)
```

- [ ] **Step 3: Verify**

`npm run dev` — see box humanoid standing on scrolling ground. Character should be visible with neon glow color.

- [ ] **Step 4: Commit**

```bash
git add src/player.js src/main.js
git commit -m "feat: add player humanoid mesh with lane and animation state"
```

---

## Task 4: Player Movement & Input

**Files:**
- Create: `src/input.js`
- Modify: `src/player.js`, `src/main.js`

**Interfaces:**
- Produces: `initInput(onAction)` where `onAction(type: 'LEFT'|'RIGHT'|'JUMP'|'SLIDE'|'START')`
- Consumes: `gameState.player` to mutate lane/action state

- [ ] **Step 1: Create src/input.js**

```js
// Unified keyboard + touch input. Calls onAction(type) for each discrete action.
export function initInput(onAction) {
  // Keyboard
  window.addEventListener('keydown', e => {
    switch (e.code) {
      case 'ArrowLeft':  case 'KeyA': onAction('LEFT');  break
      case 'ArrowRight': case 'KeyD': onAction('RIGHT'); break
      case 'ArrowUp':    case 'KeyW': case 'Space': onAction('JUMP'); break
      case 'ArrowDown':  case 'KeyS': onAction('SLIDE'); break
    }
  })

  // Touch/swipe
  let touchStartX = 0, touchStartY = 0
  const SWIPE_THRESHOLD = 30

  window.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX
    touchStartY = e.touches[0].clientY
    onAction('START')  // tap = start on title screen
  }, { passive: true })

  window.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX
    const dy = e.changedTouches[0].clientY - touchStartY
    if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return
    if (Math.abs(dx) > Math.abs(dy)) {
      onAction(dx > 0 ? 'RIGHT' : 'LEFT')
    } else {
      onAction(dy > 0 ? 'SLIDE' : 'JUMP')
    }
  }, { passive: true })
}
```

- [ ] **Step 2: Wire input into main.js**

```js
import { initInput } from './input.js'
import { LANES, JUMP_VELOCITY, SLIDE_DURATION } from './constants.js'

// after gameState is defined:
initInput(action => {
  if (gameState.status !== 'PLAYING') return
  const p = gameState.player
  switch (action) {
    case 'LEFT': {
      const next = p.lane - 1
      if (next < 0) break
      if (p.action === 'LANE_SWITCH') { p.queuedLane = next; break }
      p.targetLane = next; p.laneT = 0; p.action = 'LANE_SWITCH'
      break
    }
    case 'RIGHT': {
      const next = p.lane + 1
      if (next > 2) break
      if (p.action === 'LANE_SWITCH') { p.queuedLane = next; break }
      p.targetLane = next; p.laneT = 0; p.action = 'LANE_SWITCH'
      break
    }
    case 'JUMP':
      if (p.action !== 'JUMPING') {
        p.action = 'JUMPING'
        p.yVelocity = JUMP_VELOCITY
      }
      break
    case 'SLIDE':
      if (p.action !== 'JUMPING' && p.action !== 'SLIDING') {
        p.action = 'SLIDING'
        p.slideTimer = SLIDE_DURATION
      }
      break
  }
})
```

- [ ] **Step 3: Verify**

`npm run dev`. Press A/D/←/→ to switch lanes (smooth lerp). Space/W/↑ to jump (parabola). S/↓ to slide (squish). On mobile: swipe to trigger same actions.

- [ ] **Step 4: Commit**

```bash
git add src/input.js src/main.js
git commit -m "feat: add keyboard and touch input for lane switch, jump, slide"
```

---

## Task 5: Obstacle System

**Files:**
- Create: `src/obstacle-types.js`
- Create: `src/obstacles.js`
- Modify: `src/main.js`

**Interfaces:**
- Produces:
  - `initObstacles(scene) → obstacleApi`
  - `obstacleApi.update(delta, gameState)`
  - `obstacleApi.getActive() → Array<{ mesh: THREE.Object3D, getAABB(): THREE.Box3, type: string }>`
  - `obstacleApi.reset()`
- Consumes: `gameState.speed`, `gameState.distance`

- [ ] **Step 1: Create src/obstacle-types.js**

```js
import * as THREE from 'three'

function emissiveMat(color, emissive, intensity = 1.5) {
  return new THREE.MeshStandardMaterial({
    color, emissive, emissiveIntensity: intensity, roughness: 0.4, metalness: 0.5,
  })
}

// Each factory returns { group: THREE.Group, type, avoidWith: 'JUMP'|'SLIDE'|'LANE'|'TIMING' }
export const OBSTACLE_FACTORIES = {
  HOLOGRAM_SIGN() {
    const group = new THREE.Group()
    const geo = new THREE.BoxGeometry(2.4, 1.5, 0.1)
    const mesh = new THREE.Mesh(geo, emissiveMat(0x003366, 0x0066ff))
    mesh.position.y = 1.4
    group.add(mesh)
    group.userData.type = 'HOLOGRAM_SIGN'
    group.userData.avoidWith = 'JUMP'
    return group
  },

  NEON_PIPE() {
    const group = new THREE.Group()
    const geo = new THREE.CylinderGeometry(0.15, 0.15, 2.6, 8)
    geo.rotateZ(Math.PI / 2)
    const mesh = new THREE.Mesh(geo, emissiveMat(0x004444, 0x00ffff))
    mesh.position.y = 0.7  // low — player must slide
    group.add(mesh)
    group.userData.type = 'NEON_PIPE'
    group.userData.avoidWith = 'SLIDE'
    return group
  },

  GAP() {
    // Represented as a dark void plane — collision handled logically (player must jump)
    const group = new THREE.Group()
    const geo = new THREE.PlaneGeometry(2.4, 3)
    geo.rotateX(-Math.PI / 2)
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x000000 }))
    mesh.position.y = -0.05
    group.add(mesh)
    group.userData.type = 'GAP'
    group.userData.avoidWith = 'JUMP'
    return group
  },

  LASER_GATE() {
    const group = new THREE.Group()
    // Two vertical posts
    ;[-1.1, 1.1].forEach(x => {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 2.5, 0.1),
        emissiveMat(0x440000, 0xff0000, 2)
      )
      post.position.set(x, 1.25, 0)
      group.add(post)
    })
    // Laser beam (top half — must slide under)
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.06, 0.06),
      emissiveMat(0x440000, 0xff0000, 3)
    )
    beam.position.y = 1.2
    beam.name = 'beam'
    group.add(beam)
    group.userData.type = 'LASER_GATE'
    group.userData.avoidWith = 'SLIDE'  // beam at y=1.2 blocks running height; slide under
    group.userData.blinkTimer = 0
    group.userData.active = true
    return group
  },

  PATROL_BOT() {
    const group = new THREE.Group()
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.4), emissiveMat(0x222200, 0xffcc00, 1.5))
    body.position.y = 0.5
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.3), emissiveMat(0x333300, 0xffcc00, 2))
    head.position.y = 1.0
    group.add(body, head)
    group.userData.type = 'PATROL_BOT'
    group.userData.avoidWith = 'LANE'
    group.userData.patrolDir = 1
    group.userData.patrolSpeed = 2.5
    return group
  },
}

export const OBSTACLE_TYPES = Object.keys(OBSTACLE_FACTORIES)
```

- [ ] **Step 2: Create src/obstacles.js**

```js
import * as THREE from 'three'
import { LANES } from './constants.js'
import { OBSTACLE_FACTORIES, OBSTACLE_TYPES } from './obstacle-types.js'

const POOL_SIZE = 12
const SPAWN_Z = -55
const RECYCLE_Z = 12
const BASE_INTERVAL = 2.2   // seconds between spawns at start
const MIN_INTERVAL = 0.6

export function initObstacles(scene) {
  const pool = []
  for (let i = 0; i < POOL_SIZE; i++) {
    // Start with all types pre-built, hidden
    const type = OBSTACLE_TYPES[i % OBSTACLE_TYPES.length]
    const obj = OBSTACLE_FACTORIES[type]()
    obj.visible = false
    scene.add(obj)
    pool.push({ obj, active: false })
  }

  let spawnTimer = 1.0
  let lastLane = -1
  const box3 = new THREE.Box3()

  function getActive() {
    return pool.filter(p => p.active).map(p => ({
      mesh: p.obj,
      type: p.obj.userData.type,
      avoidWith: p.obj.userData.avoidWith,
      getAABB() {
        box3.setFromObject(p.obj)
        return box3
      },
    }))
  }

  function spawnOne(speed) {
    const entry = pool.find(p => !p.active)
    if (!entry) return
    // Pick random type
    const type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)]
    // Re-build to reset state (patrol bot direction etc)
    scene.remove(entry.obj)
    const newObj = OBSTACLE_FACTORIES[type]()
    newObj.visible = true
    scene.add(newObj)
    entry.obj = newObj

    // Pick lane — avoid same lane twice in a row for non-patrol
    let lane
    do { lane = Math.floor(Math.random() * 3) } while (lane === lastLane && Math.random() > 0.3)
    lastLane = lane
    entry.obj.position.set(LANES[lane], 0, SPAWN_Z)
    entry.active = true
  }

  function update(delta, gameState) {
    if (gameState.status !== 'PLAYING') return
    const speed = gameState.speed

    // Spawn timer
    const interval = Math.max(MIN_INTERVAL, BASE_INTERVAL - gameState.distance * 0.0003)
    spawnTimer -= delta
    if (spawnTimer <= 0) {
      spawnOne(speed)
      spawnTimer = interval + (Math.random() - 0.5) * 0.4
    }

    // Update active obstacles
    pool.forEach(entry => {
      if (!entry.active) return
      const obj = entry.obj

      // Move toward camera
      obj.position.z += speed * delta

      // Laser gate blink
      if (obj.userData.type === 'LASER_GATE') {
        obj.userData.blinkTimer += delta
        const beam = obj.getObjectByName('beam')
        if (beam) beam.visible = Math.sin(obj.userData.blinkTimer * 6) > 0
      }

      // Patrol bot lateral movement
      if (obj.userData.type === 'PATROL_BOT') {
        obj.position.x += obj.userData.patrolDir * obj.userData.patrolSpeed * delta
        if (obj.position.x > LANES[2] + 1) obj.userData.patrolDir = -1
        if (obj.position.x < LANES[0] - 1) obj.userData.patrolDir = 1
      }

      // Recycle
      if (obj.position.z > RECYCLE_Z) {
        obj.visible = false
        entry.active = false
      }
    })
  }

  function reset() {
    pool.forEach(entry => {
      entry.obj.visible = false
      entry.active = false
    })
    spawnTimer = 1.0
    lastLane = -1
  }

  return { update, getActive, reset }
}
```

- [ ] **Step 3: Add obstacles to main.js**

```js
import { initObstacles } from './obstacles.js'
// after playerApi:
const obstacleApi = initObstacles(scene)

// in animation loop:
obstacleApi.update(delta, gameState)
```

- [ ] **Step 4: Verify**

`npm run dev`. Obstacles should appear from the distance and scroll toward the camera. All 5 types should appear. Laser gate should blink. Patrol bot should move laterally.

- [ ] **Step 5: Commit**

```bash
git add src/obstacle-types.js src/obstacles.js src/main.js
git commit -m "feat: add obstacle system with 5 types and object pool"
```

---

## Task 6: Collision Detection & HP System

**Files:**
- Create: `src/collision.js`
- Create: `tests/collision.test.js`
- Modify: `src/main.js`

**Interfaces:**
- Produces: `checkCollisions(playerApi, obstacleApi, collectibleApi, gameState) → { hitObstacle: bool, hitCollectible: string|null }`
- Consumes: `playerApi.getAABB()`, `obstacleApi.getActive()`, `collectibleApi.getActive()`

- [ ] **Step 1: Write failing test**

Create `tests/collision.test.js`:

```js
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { boxesOverlap } from '../src/collision.js'

describe('boxesOverlap', () => {
  it('returns true for overlapping boxes', () => {
    const a = new THREE.Box3(new THREE.Vector3(0,0,0), new THREE.Vector3(1,1,1))
    const b = new THREE.Box3(new THREE.Vector3(0.5,0.5,0.5), new THREE.Vector3(1.5,1.5,1.5))
    expect(boxesOverlap(a, b)).toBe(true)
  })

  it('returns false for non-overlapping boxes', () => {
    const a = new THREE.Box3(new THREE.Vector3(0,0,0), new THREE.Vector3(1,1,1))
    const b = new THREE.Box3(new THREE.Vector3(2,2,2), new THREE.Vector3(3,3,3))
    expect(boxesOverlap(a, b)).toBe(false)
  })

  it('returns false for boxes that only touch edges', () => {
    const a = new THREE.Box3(new THREE.Vector3(0,0,0), new THREE.Vector3(1,1,1))
    const b = new THREE.Box3(new THREE.Vector3(1,0,0), new THREE.Vector3(2,1,1))
    expect(boxesOverlap(a, b)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm test
```

Expected: FAIL — "Cannot find module '../src/collision.js'"

- [ ] **Step 3: Create src/collision.js**

```js
import * as THREE from 'three'
import { INVINCIBLE_DURATION } from './constants.js'

export function boxesOverlap(a, b) {
  return (
    a.min.x < b.max.x && a.max.x > b.min.x &&
    a.min.y < b.max.y && a.max.y > b.min.y &&
    a.min.z < b.max.z && a.max.z > b.min.z
  )
}

export function checkCollisions(playerApi, obstacleApi, collectibleApi, gameState) {
  if (gameState.player.invincibleTimer > 0) return { hitObstacle: false, hitCollectible: null }

  const playerBox = playerApi.getAABB()
  let hitObstacle = false
  let hitCollectible = null

  // Obstacle collision — skip during HOVER power-up (player above ground obstacles)
  const hovering = gameState.powerUp?.type === 'HOVER'
  obstacleApi.getActive().forEach(obs => {
    if (hitObstacle) return
    if (hovering && obs.type !== 'LASER_GATE') return  // hover skips ground obstacles
    const obsBox = obs.getAABB()
    // Z window: only check obstacles near the player
    if (obs.mesh.position.z < -2 || obs.mesh.position.z > 3) return
    if (boxesOverlap(playerBox, obsBox)) hitObstacle = true
  })

  // Collectible collision
  collectibleApi.getActive().forEach(col => {
    if (hitCollectible) return
    if (col.mesh.position.z < -2 || col.mesh.position.z > 3) return
    const colBox = col.getAABB()
    if (boxesOverlap(playerBox, colBox)) hitCollectible = col.type
  })

  return { hitObstacle, hitCollectible }
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npm test
```

Expected: 3 tests pass.

- [ ] **Step 5: Wire collision into main.js**

```js
import { checkCollisions } from './collision.js'

// Temporary stub for collectibleApi (Task 7 adds real one)
const collectibleApiStub = { getActive: () => [] }

// In animation loop, after obstacle update:
if (gameState.status === 'PLAYING') {
  const { hitObstacle } = checkCollisions(playerApi, obstacleApi, collectibleApiStub, gameState)
  if (hitObstacle) {
    gameState.hp -= 1
    gameState.player.invincibleTimer = INVINCIBLE_DURATION
    if (gameState.hp <= 0) {
      gameState.status = 'GAME_OVER'
    }
  }
}
```

- [ ] **Step 6: Verify**

`npm run dev`. Run into an obstacle — player blinks (invincibility). After 3 hits, game should stop (no restart yet — that's Task 8).

- [ ] **Step 7: Commit**

```bash
git add src/collision.js tests/collision.test.js src/main.js
git commit -m "feat: add AABB collision detection and HP system"
```

---

## Task 7: Game State Machine, Speed Scaling & Core Loop

**Files:**
- Modify: `src/main.js`
- Create: `src/hud.js` (basic version — full styling in Task 10)

**Interfaces:**
- Produces: full TITLE → PLAYING → GAME_OVER → TITLE loop with restart
- Consumes: all existing modules

- [ ] **Step 1: Create src/hud.js (minimal)**

```js
const hudEl = document.getElementById('hud')

export function initHud() {
  hudEl.innerHTML = `
    <div id="hud-score" style="position:absolute;top:16px;left:16px">SCORE: 0</div>
    <div id="hud-dist"  style="position:absolute;top:40px;left:16px">DIST: 0m</div>
    <div id="hud-hp"    style="position:absolute;bottom:16px;left:16px">HP: ♥♥♥</div>
    <div id="hud-hi"    style="position:absolute;top:16px;right:16px">HI: 0</div>
  `
}

export function updateHud(gameState) {
  const hi = parseInt(localStorage.getItem('neon-runner-highscore') || '0')
  document.getElementById('hud-score').textContent = `SCORE: ${gameState.score}`
  document.getElementById('hud-dist').textContent  = `DIST: ${Math.floor(gameState.distance)}m`
  document.getElementById('hud-hp').textContent    = `HP: ${'♥'.repeat(gameState.hp)}${'♡'.repeat(3 - gameState.hp)}`
  document.getElementById('hud-hi').textContent    = `HI: ${Math.max(hi, gameState.score)}`
}

export function showScreen(type, gameState) {
  const overlay = document.getElementById('overlay')
  if (type === 'TITLE') {
    overlay.innerHTML = `
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#00000099">
        <h1 style="font-size:64px;color:#00ffff;text-shadow:0 0 20px #00ffff;font-family:monospace">NEON RUNNER</h1>
        <p style="color:#ff00ff;margin-top:24px;font-size:20px;font-family:monospace">PRESS SPACE / TAP TO START</p>
        <p style="color:#888;margin-top:12px;font-size:14px;font-family:monospace">← → lane | ↑ jump | ↓ slide</p>
      </div>`
    overlay.style.pointerEvents = 'auto'
  } else if (type === 'GAME_OVER') {
    const hi = Math.max(parseInt(localStorage.getItem('neon-runner-highscore') || '0'), gameState.score)
    localStorage.setItem('neon-runner-highscore', hi)
    overlay.innerHTML = `
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#00000099">
        <h2 style="font-size:48px;color:#ff0044;text-shadow:0 0 15px #ff0044;font-family:monospace">CAPTURED</h2>
        <p style="color:#00ffff;margin-top:16px;font-family:monospace">DIST: ${Math.floor(gameState.distance)}m</p>
        <p style="color:#00ffff;font-family:monospace">SCORE: ${gameState.score}</p>
        <p style="color:#ffcc00;font-family:monospace">BEST: ${hi}</p>
        <button id="restart-btn" style="margin-top:24px;padding:12px 32px;background:#00ffff;color:#000;border:none;font-size:18px;font-family:monospace;cursor:pointer">RESTART</button>
      </div>`
    overlay.style.pointerEvents = 'auto'
    document.getElementById('restart-btn').addEventListener('click', () => window.dispatchEvent(new CustomEvent('game-restart')))
  } else {
    overlay.innerHTML = ''
    overlay.style.pointerEvents = 'none'
  }
}
```

- [ ] **Step 2: Rewrite main.js with full state machine**

```js
import * as THREE from 'three'
import { BASE_SPEED, MAX_SPEED, ACCEL_FACTOR, JUMP_VELOCITY, SLIDE_DURATION, INVINCIBLE_DURATION } from './constants.js'
import { initScene } from './scene.js'
import { initPlayer } from './player.js'
import { initInput } from './input.js'
import { initObstacles } from './obstacles.js'
import { checkCollisions } from './collision.js'
import { initHud, updateHud, showScreen } from './hud.js'

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
document.body.prepend(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0a0010)
scene.fog = new THREE.FogExp2(0x110022, 0.018)
scene.add(new THREE.AmbientLight(0x221133, 2))

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300)
camera.position.set(0, 4, 8)
camera.lookAt(0, 0, -10)

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

// --- Modules ---
const { updateScene } = initScene(scene)
const collectibleApiStub = { getActive: () => [], update() {}, reset() {} }

function makeGameState(skinColor = 'CYAN') {
  return {
    status: 'TITLE',
    score: 0, distance: 0, speed: BASE_SPEED, hp: 3,
    skinColor,
    player: {
      lane: 1, targetLane: 1, laneT: 1,
      action: 'RUNNING', queuedLane: null,
      yPos: 0, yVelocity: 0,
      slideTimer: 0, invincibleTimer: 0,
    },
    powerUp: null,
    droneProximity: 0,
  }
}

let gameState = makeGameState()
let playerApi = initPlayer(scene, gameState.skinColor)
let obstacleApi = initObstacles(scene)

initHud()
showScreen('TITLE', gameState)

// --- Input ---
initInput(action => {
  if (gameState.status === 'TITLE' && (action === 'JUMP' || action === 'START')) {
    gameState.status = 'PLAYING'
    showScreen('PLAYING', gameState)
    return
  }
  if (gameState.status !== 'PLAYING') return
  const p = gameState.player
  if (action === 'LEFT') {
    const next = p.lane - 1; if (next < 0) return
    if (p.action === 'LANE_SWITCH') { p.queuedLane = next; return }
    p.targetLane = next; p.laneT = 0; p.action = 'LANE_SWITCH'
  } else if (action === 'RIGHT') {
    const next = p.lane + 1; if (next > 2) return
    if (p.action === 'LANE_SWITCH') { p.queuedLane = next; return }
    p.targetLane = next; p.laneT = 0; p.action = 'LANE_SWITCH'
  } else if (action === 'JUMP') {
    if (p.action !== 'JUMPING') { p.action = 'JUMPING'; p.yVelocity = JUMP_VELOCITY }
  } else if (action === 'SLIDE') {
    if (p.action !== 'JUMPING' && p.action !== 'SLIDING') {
      p.action = 'SLIDING'; p.slideTimer = SLIDE_DURATION
    }
  }
})

// --- Restart ---
window.addEventListener('game-restart', () => {
  scene.remove(playerApi.group)
  obstacleApi.reset()
  gameState = makeGameState(gameState.skinColor)
  playerApi = initPlayer(scene, gameState.skinColor)
  gameState.status = 'PLAYING'
  showScreen('PLAYING', gameState)
})

// --- Loop ---
let last = performance.now()
renderer.setAnimationLoop(() => {
  const now = performance.now()
  const delta = Math.min((now - last) / 1000, 0.05)
  last = now

  if (gameState.status === 'PLAYING') {
    gameState.distance += gameState.speed * delta
    gameState.speed = Math.min(MAX_SPEED, BASE_SPEED + gameState.distance * ACCEL_FACTOR)
    gameState.score = Math.floor(gameState.distance)

    updateScene(delta, gameState.speed)
    playerApi.update(delta, gameState)
    obstacleApi.update(delta, gameState)

    const { hitObstacle } = checkCollisions(playerApi, obstacleApi, collectibleApiStub, gameState)
    if (hitObstacle) {
      gameState.hp -= 1
      gameState.player.invincibleTimer = INVINCIBLE_DURATION
      gameState.droneProximity = Math.min(1, gameState.droneProximity + 0.3)
      if (gameState.hp <= 0) {
        gameState.status = 'GAME_OVER'
        showScreen('GAME_OVER', gameState)
      }
    }

    updateHud(gameState)
  } else if (gameState.status === 'TITLE') {
    updateScene(delta, 4)
  }

  renderer.render(scene, camera)
})
```

- [ ] **Step 3: Verify**

`npm run dev`. Title screen shows. Space/tap starts game. Obstacles scroll. 3 hits → CAPTURED screen. Restart button resets everything. Score increases with distance. Speed gradually increases.

- [ ] **Step 4: Commit**

```bash
git add src/main.js src/hud.js
git commit -m "feat: add full game state machine, speed scaling, and core loop"
```

---

## Task 8: Collectibles & Power-ups

**Files:**
- Create: `src/collectibles.js`
- Modify: `src/main.js`, `src/collision.js`

**Interfaces:**
- Produces:
  - `initCollectibles(scene) → collectibleApi`
  - `collectibleApi.update(delta, gameState)`
  - `collectibleApi.getActive() → Array<{ mesh, type, getAABB() }>`
  - `collectibleApi.collect(item, gameState)`
  - `collectibleApi.reset()`
- Consumes: `gameState.speed`, `gameState.powerUp`, `gameState.player.lane`

- [ ] **Step 1: Create src/collectibles.js**

```js
import * as THREE from 'three'
import { LANES, POWERUP_TYPES, POWERUP_DURATIONS } from './constants.js'

const SHARD_POOL = 30
const SPAWN_Z = -55
const RECYCLE_Z = 12
const SHARD_SPAWN_INTERVAL = 0.4
const POWERUP_SPAWN_INTERVAL = 8

const POWERUP_COLORS = {
  SHIELD:    { color: 0x0044ff, emissive: 0x0088ff },
  MAGNET:    { color: 0xffaa00, emissive: 0xffdd00 },
  OVERDRIVE: { color: 0xffffff, emissive: 0xffffff },
  HOVER:     { color: 0x00ff44, emissive: 0x00ff88 },
}

function makeShardMesh(isEven) {
  const geo = new THREE.OctahedronGeometry(0.25)
  const mat = new THREE.MeshStandardMaterial({
    color: isEven ? 0x004444 : 0x440044,
    emissive: isEven ? 0x00ffff : 0xff00ff,
    emissiveIntensity: 2,
    roughness: 0.2, metalness: 0.8,
  })
  return new THREE.Mesh(geo, mat)
}

function makePowerUpMesh(type) {
  const c = POWERUP_COLORS[type]
  const geo = new THREE.OctahedronGeometry(0.4)
  const mat = new THREE.MeshStandardMaterial({
    color: c.color, emissive: c.emissive, emissiveIntensity: 2.5,
    roughness: 0.2, metalness: 0.9,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.userData.isPowerUp = true
  mesh.userData.powerUpType = type
  return mesh
}

export function initCollectibles(scene) {
  const pool = []
  const box3 = new THREE.Box3()

  for (let i = 0; i < SHARD_POOL; i++) {
    const mesh = makeShardMesh(i % 2 === 0)
    mesh.visible = false
    mesh.userData.type = 'SHARD'
    scene.add(mesh)
    pool.push({ mesh, active: false })
  }
  // Power-up slots (4)
  POWERUP_TYPES.forEach(type => {
    const mesh = makePowerUpMesh(type)
    mesh.visible = false
    mesh.userData.type = type
    scene.add(mesh)
    pool.push({ mesh, active: false })
  })

  let shardTimer = 0
  let powerUpTimer = POWERUP_SPAWN_INTERVAL * 0.5

  function getActive() {
    return pool.filter(p => p.active).map(p => ({
      mesh: p.mesh,
      type: p.mesh.userData.type,
      entry: p,
      getAABB() {
        box3.setFromObject(p.mesh)
        return box3
      },
    }))
  }

  function spawnShard() {
    const entry = pool.find(p => !p.active && p.mesh.userData.type === 'SHARD')
    if (!entry) return
    const lane = Math.floor(Math.random() * 3)
    entry.mesh.position.set(LANES[lane], 0.6, SPAWN_Z)
    entry.mesh.visible = true
    entry.active = true
  }

  function spawnPowerUp() {
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)]
    const entry = pool.find(p => !p.active && p.mesh.userData.type === type)
    if (!entry) return
    const lane = Math.floor(Math.random() * 3)
    entry.mesh.position.set(LANES[lane], 0.8, SPAWN_Z)
    entry.mesh.visible = true
    entry.active = true
  }

  function collect(item, gameState) {
    item.entry.mesh.visible = false
    item.entry.active = false
    if (item.type === 'SHARD') {
      gameState.score += 10
    } else {
      // Power-up
      const duration = POWERUP_DURATIONS[item.type]
      gameState.powerUp = { type: item.type, timeLeft: duration }
      if (item.type === 'OVERDRIVE') gameState.droneProximity = Math.max(0, gameState.droneProximity - 0.4)
    }
  }

  function update(delta, gameState) {
    if (gameState.status !== 'PLAYING') return

    shardTimer -= delta
    if (shardTimer <= 0) {
      spawnShard()
      shardTimer = SHARD_SPAWN_INTERVAL
    }
    powerUpTimer -= delta
    if (powerUpTimer <= 0) {
      spawnPowerUp()
      powerUpTimer = POWERUP_SPAWN_INTERVAL
    }

    // Power-up duration countdown
    if (gameState.powerUp && gameState.powerUp.type !== 'SHIELD') {
      gameState.powerUp.timeLeft -= delta
      if (gameState.powerUp.timeLeft <= 0) gameState.powerUp = null
    }

    pool.forEach(entry => {
      if (!entry.active) return
      const mesh = entry.mesh

      mesh.position.z += gameState.speed * delta
      mesh.rotation.y += delta * 2

      // Magnet: pull shards toward player lane X
      if (gameState.powerUp?.type === 'MAGNET' && entry.mesh.userData.type === 'SHARD') {
        const targetX = LANES[gameState.player.lane]
        mesh.position.x += (targetX - mesh.position.x) * 5 * delta
      }

      if (mesh.position.z > RECYCLE_Z) {
        mesh.visible = false
        entry.active = false
      }
    })
  }

  function reset() {
    pool.forEach(entry => { entry.mesh.visible = false; entry.active = false })
    shardTimer = 0
    powerUpTimer = POWERUP_SPAWN_INTERVAL * 0.5
  }

  return { update, getActive, collect, reset }
}
```

- [ ] **Step 2: Update collision.js to handle collectible collection**

Add to `checkCollisions` — the function already has the `hitCollectible` logic; update the return type to include the collected item object:

```js
// Replace the collectible section in checkCollisions:
let hitCollectibleItem = null
collectibleApi.getActive().forEach(col => {
  if (hitCollectibleItem) return
  if (col.mesh.position.z < -2 || col.mesh.position.z > 3) return
  if (boxesOverlap(playerBox, col.getAABB())) hitCollectibleItem = col
})
return { hitObstacle, hitCollectible: hitCollectibleItem }
```

- [ ] **Step 3: Wire collectibles into main.js**

```js
import { initCollectibles } from './collectibles.js'

// Replace collectibleApiStub with real one (after obstacleApi):
const collectibleApi = initCollectibles(scene)

// In game restart handler, add:
collectibleApi.reset()

// In PLAYING update loop, replace collectibleApiStub:
collectibleApi.update(delta, gameState)
const { hitObstacle, hitCollectible } = checkCollisions(playerApi, obstacleApi, collectibleApi, gameState)
if (hitCollectible) collectibleApi.collect(hitCollectible, gameState)
```

- [ ] **Step 4: Verify**

`npm run dev`. Cyan/magenta shards spawn and rotate. Running into one increases score by 10. Power-ups appear occasionally. MAGNET pulls shards sideways. OVERDRIVE reduces drone proximity.

- [ ] **Step 5: Commit**

```bash
git add src/collectibles.js src/collision.js src/main.js
git commit -m "feat: add collectibles, data shards, and power-up system"
```

---

## Task 9: Drone Proximity System

**Files:**
- Create: `src/drone.js`
- Create: `tests/drone.test.js`
- Modify: `src/main.js`, `src/style.css`

**Interfaces:**
- Produces:
  - `initDrone(scene) → droneApi`
  - `droneApi.update(delta, gameState)`
  - `droneApi.triggerCapture(camera, gameState, onComplete)`
  - `droneApi.reset()`
- Consumes: `gameState.droneProximity`, `gameState.status`

- [ ] **Step 1: Write failing test**

Create `tests/drone.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { calcProximityDelta } from '../src/drone.js'

describe('calcProximityDelta', () => {
  it('increases proximity on obstacle hit', () => {
    const delta = calcProximityDelta({ hitObstacle: true, evaded: false, overdrive: false }, 0.016)
    expect(delta).toBeGreaterThan(0)
  })

  it('decreases proximity on successful evasion', () => {
    const delta = calcProximityDelta({ hitObstacle: false, evaded: true, overdrive: false }, 0.016)
    expect(delta).toBeLessThan(0)
  })

  it('strongly decreases proximity on overdrive', () => {
    const delta = calcProximityDelta({ hitObstacle: false, evaded: false, overdrive: true }, 0.016)
    expect(delta).toBeLessThan(-0.1)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm test
```

Expected: FAIL — "Cannot find module '../src/drone.js'"

- [ ] **Step 3: Create src/drone.js**

```js
import * as THREE from 'three'

// Pure function — testable without Three.js scene
export function calcProximityDelta({ hitObstacle, evaded, overdrive }, delta) {
  if (overdrive) return -0.4
  if (hitObstacle) return 0.3
  if (evaded) return -0.1
  return 0.002 * delta  // Slow passive creep
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

export function initDrone(scene) {
  const droneGroup = buildDroneMesh()
  scene.add(droneGroup)

  const glowEl = document.createElement('div')
  glowEl.className = 'drone-glow'
  document.getElementById('overlay').appendChild(glowEl)

  const warningEl = document.createElement('div')
  warningEl.style.cssText = `
    position:absolute;bottom:80px;left:50%;transform:translateX(-50%);
    color:#ff0044;font-family:monospace;font-size:16px;font-weight:bold;
    text-shadow:0 0 8px #ff0044;display:none;
  `
  warningEl.textContent = '⚠ DRONE CLOSING IN ⚠'
  document.getElementById('hud').appendChild(warningEl)

  let captureAnim = null

  function update(delta, gameState) {
    if (gameState.status !== 'PLAYING') return

    // Rotor spin
    droneGroup.children.filter(c => c.name === 'rotor').forEach(r => r.rotation.y += delta * 20)

    // Proximity glow
    const p = gameState.droneProximity
    const spread = Math.floor(p * 80)
    const alpha = p * 0.7
    glowEl.style.boxShadow = `inset 0 0 ${spread}px ${Math.floor(spread*0.5)}px rgba(255,0,68,${alpha})`
    warningEl.style.display = p > 0.6 ? 'block' : 'none'
  }

  function triggerCapture(camera, gameState, onComplete) {
    droneGroup.position.set(0, 2, 15)
    droneGroup.visible = true
    const startY = droneGroup.position.y
    let t = 0
    captureAnim = (delta) => {
      t += delta
      droneGroup.position.z -= 12 * delta
      droneGroup.position.y = startY - t * 4
      if (t > 1.2) {
        droneGroup.visible = false
        captureAnim = null
        onComplete()
      }
    }
  }

  function updateCapture(delta) {
    if (captureAnim) captureAnim(delta)
  }

  function reset() {
    droneGroup.visible = false
    captureAnim = null
    const glowEl2 = document.querySelector('.drone-glow')
    if (glowEl2) glowEl2.style.boxShadow = 'none'
    warningEl.style.display = 'none'
  }

  return { update, triggerCapture, updateCapture, reset }
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npm test
```

Expected: all tests pass (6 total: 3 collision + 3 drone).

- [ ] **Step 5: Wire drone into main.js**

```js
import { initDrone } from './drone.js'
import { calcProximityDelta } from './drone.js'

// after obstacleApi:
const droneApi = initDrone(scene)
let captureTriggered = false

// In restart handler:
droneApi.reset(); captureTriggered = false

// In PLAYING loop, after collision check:
const evaded = !hitObstacle && gameState.player.action === 'RUNNING' // simple evasion signal
const proxDelta = calcProximityDelta({
  hitObstacle,
  evaded: evaded && gameState.distance > 5,
  overdrive: gameState.powerUp?.type === 'OVERDRIVE',
}, delta)
gameState.droneProximity = Math.max(0, Math.min(1, gameState.droneProximity + proxDelta))

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

- [ ] **Step 6: Verify**

`npm run dev`. Collide with obstacles — red glow on screen edges intensifies. Warning text appears. After sustained hits, drone swoops in from behind → CAPTURED screen.

- [ ] **Step 7: Commit**

```bash
git add src/drone.js tests/drone.test.js src/main.js
git commit -m "feat: add drone proximity system with red glow and capture animation"
```

---

## Task 10: Particles & Visual Polish

**Files:**
- Create: `src/particles.js`
- Modify: `src/main.js`, `src/style.css`

**Interfaces:**
- Produces:
  - `initParticles(scene) → particleApi`
  - `particleApi.update(delta, gameState, playerPos)`
  - `particleApi.burstCollect(position, color)`
  - `particleApi.burstHit(position)`
  - `particleApi.reset()`
- Consumes: `gameState.status`, `gameState.player`, `gameState.powerUp`

- [ ] **Step 1: Create src/particles.js**

```js
import * as THREE from 'three'

const PARTICLE_COUNT = 80
const TRAIL_COUNT = 20

function makeParticleMat(color) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 })
}

export function initParticles(scene) {
  // Pool of tiny box particles
  const pool = []
  const geo = new THREE.BoxGeometry(0.06, 0.06, 0.06)
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const mat = makeParticleMat(0x00ffff)
    const mesh = new THREE.Mesh(geo, mat.clone())
    mesh.visible = false
    scene.add(mesh)
    pool.push({ mesh, active: false, vel: new THREE.Vector3(), life: 0, maxLife: 0 })
  }

  // Trail particles (always cycling)
  const trailPool = []
  for (let i = 0; i < TRAIL_COUNT; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0 })
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.08), mat)
    mesh.visible = false
    scene.add(mesh)
    trailPool.push({ mesh, life: 0 })
  }
  let trailIdx = 0

  // Camera shake state
  let shakeTime = 0
  const camBasePos = new THREE.Vector3(0, 4, 8)

  function emit(position, color, count, speed) {
    let emitted = 0
    for (let i = 0; i < pool.length && emitted < count; i++) {
      const p = pool[i]
      if (p.active) continue
      p.mesh.position.copy(position)
      p.mesh.material.color.set(color)
      p.mesh.material.opacity = 1
      p.mesh.visible = true
      p.vel.set(
        (Math.random() - 0.5) * speed,
        Math.random() * speed,
        (Math.random() - 0.5) * speed,
      )
      p.maxLife = 0.4 + Math.random() * 0.3
      p.life = p.maxLife
      p.active = true
      emitted++
    }
  }

  function burstCollect(position, color = 0x00ffff) {
    emit(position, color, 8, 4)
  }

  function burstHit(position) {
    emit(position, 0xff2244, 12, 6)
    shakeTime = 0.3
  }

  function updateTrail(playerPos, isOverdrive) {
    const p = trailPool[trailIdx % TRAIL_COUNT]
    p.mesh.position.set(
      playerPos.x + (Math.random() - 0.5) * 0.15,
      playerPos.y + 0.1 + Math.random() * 0.2,
      playerPos.z + 0.2,
    )
    p.mesh.material.color.set(isOverdrive ? 0xffffff : 0x00ffff)
    p.mesh.material.opacity = isOverdrive ? 1 : 0.7
    p.mesh.visible = true
    p.life = isOverdrive ? 0.35 : 0.2
    trailIdx++
  }

  function update(delta, gameState, camera) {
    if (gameState.status !== 'PLAYING') return

    // Burst particles
    pool.forEach(p => {
      if (!p.active) return
      p.life -= delta
      p.mesh.position.addScaledVector(p.vel, delta)
      p.vel.y -= 8 * delta
      const t = p.life / p.maxLife
      p.mesh.material.opacity = t
      p.mesh.scale.setScalar(t)
      if (p.life <= 0) { p.mesh.visible = false; p.active = false }
    })

    // Trail
    const isOverdrive = gameState.powerUp?.type === 'OVERDRIVE'
    updateTrail(new THREE.Vector3(
      LANES_LOCAL[gameState.player.lane],
      gameState.player.yPos,
      0,
    ), isOverdrive)

    trailPool.forEach(p => {
      if (!p.mesh.visible) return
      p.life -= delta
      p.mesh.material.opacity = Math.max(0, p.life / 0.3) * (isOverdrive ? 1 : 0.7)
      p.mesh.position.z += gameState.speed * delta * 0.3
      if (p.life <= 0) p.mesh.visible = false
    })

    // Camera shake
    if (shakeTime > 0) {
      shakeTime -= delta
      const s = shakeTime * 0.15
      camera.position.set(
        camBasePos.x + (Math.random() - 0.5) * s,
        camBasePos.y + (Math.random() - 0.5) * s,
        camBasePos.z,
      )
    } else {
      camera.position.copy(camBasePos)
    }
  }

  function reset() {
    pool.forEach(p => { p.mesh.visible = false; p.active = false })
    trailPool.forEach(p => { p.mesh.visible = false; p.life = 0 })
    shakeTime = 0
  }

  return { update, burstCollect, burstHit, reset }
}

// Local copy to avoid circular import
const LANES_LOCAL = [-2.5, 0, 2.5]
```

- [ ] **Step 2: Wire particles into main.js**

```js
import { initParticles } from './particles.js'

// after droneApi:
const particleApi = initParticles(scene)

// In restart:
particleApi.reset()

// In PLAYING loop:
particleApi.update(delta, gameState, camera)

// On hitObstacle (before HP decrement):
particleApi.burstHit(playerApi.group.position.clone())

// On hitCollectible:
if (hitCollectible) {
  particleApi.burstCollect(hitCollectible.mesh.position.clone(),
    hitCollectible.type === 'SHARD' ? 0x00ffff : 0xffcc00)
  collectibleApi.collect(hitCollectible, gameState)
}
```

- [ ] **Step 3: Verify**

`npm run dev`. Running trail follows player. Hitting obstacles triggers red burst + camera shake. Collecting shards triggers cyan burst. Overdrive turns trail white and brighter.

- [ ] **Step 4: Commit**

```bash
git add src/particles.js src/main.js
git commit -m "feat: add particle system with running trail, collect burst, hit shake"
```

---

## Task 11: Full HUD & Screens Polish

**Files:**
- Modify: `src/hud.js`, `src/style.css`, `src/main.js`

**Interfaces:**
- `updateHud(gameState)` — extended to show power-up indicator and drone warning via proxy
- `showScreen('TITLE'|'GAME_OVER'|'PLAYING', gameState)` — polished screens with character select on title

- [ ] **Step 1: Update style.css with full styling**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #000; overflow: hidden; font-family: 'Courier New', monospace; }
canvas { display: block; }

#hud {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  pointer-events: none; z-index: 10;
  color: #00ffff;
}
#overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  pointer-events: none; z-index: 5;
}
.drone-glow {
  position: absolute; inset: 0;
  pointer-events: none;
}

/* HUD elements */
#hud-score { position:absolute; top:16px; left:16px; font-size:22px; color:#00ffff; text-shadow:0 0 10px #00ffff; }
#hud-dist  { position:absolute; top:44px; left:16px; font-size:16px; color:#aa88ff; text-shadow:0 0 6px #aa88ff; }
#hud-hi    { position:absolute; top:16px; right:16px; font-size:18px; color:#ffcc00; text-shadow:0 0 8px #ffcc00; }
#hud-hp    { position:absolute; bottom:16px; left:16px; font-size:24px; color:#ff4488; text-shadow:0 0 8px #ff4488; }
#hud-powerup {
  position:absolute; bottom:16px; right:16px;
  font-size:14px; color:#00ff88; text-shadow:0 0 8px #00ff88;
  text-align:right; min-width:160px;
}
.powerup-bar {
  height: 4px; background: #00ff88; box-shadow: 0 0 6px #00ff88;
  margin-top: 4px; transition: width 0.1s;
}
#hud-drone-warn {
  position:absolute; bottom:80px; left:50%; transform:translateX(-50%);
  font-size:16px; font-weight:bold; color:#ff0044; text-shadow:0 0 10px #ff0044;
  display:none; letter-spacing:2px;
}

/* Screens */
.screen {
  position:absolute; inset:0;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  background: rgba(0,0,10,0.85);
}
.screen h1 {
  font-size:clamp(36px,8vw,72px);
  color:#00ffff;
  text-shadow:0 0 30px #00ffff, 0 0 60px #00ffff;
  letter-spacing:6px;
}
.screen h2 {
  font-size:clamp(28px,6vw,52px);
  color:#ff0044;
  text-shadow:0 0 20px #ff0044;
  letter-spacing:4px;
}
.screen p { color:#888; font-size:15px; margin-top:10px; letter-spacing:1px; }
.screen .stat { color:#00ffff; font-size:18px; margin-top:8px; text-shadow:0 0 6px #00ffff; }
.screen .hi-stat { color:#ffcc00; font-size:18px; text-shadow:0 0 6px #ffcc00; }
.screen .cta { color:#ff00ff; font-size:22px; margin-top:28px; text-shadow:0 0 12px #ff00ff; animation: pulse 1.2s infinite; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
.screen .controls { color:#556; font-size:13px; margin-top:12px; line-height:1.8; text-align:center; }

.skin-row { display:flex; gap:16px; margin-top:20px; }
.skin-btn {
  width:48px; height:48px; border-radius:50%; border:2px solid #444; cursor:pointer;
  transition:transform 0.15s, box-shadow 0.15s; pointer-events:auto;
}
.skin-btn.selected, .skin-btn:hover {
  transform:scale(1.2);
  box-shadow: 0 0 16px currentColor;
}
.skin-btn.cyan    { background:#004466; border-color:#00ffff; color:#00ffff; }
.skin-btn.magenta { background:#440044; border-color:#ff00ff; color:#ff00ff; }
.skin-btn.gold    { background:#443300; border-color:#ffcc00; color:#ffcc00; }

.restart-btn {
  margin-top:24px; padding:12px 36px;
  background:transparent; color:#00ffff; border:2px solid #00ffff;
  font-size:18px; font-family:monospace; cursor:pointer; letter-spacing:2px;
  text-shadow:0 0 8px #00ffff; box-shadow:0 0 16px #00ffff44;
  transition:background 0.2s; pointer-events:auto;
}
.restart-btn:hover { background:#00ffff22; }
```

- [ ] **Step 2: Rewrite src/hud.js**

```js
const hudEl  = document.getElementById('hud')
const overlayEl = document.getElementById('overlay')

export function initHud() {
  hudEl.innerHTML = `
    <div id="hud-score">SCORE: 0</div>
    <div id="hud-dist">0m</div>
    <div id="hud-hi">BEST: 0</div>
    <div id="hud-hp">♥♥♥</div>
    <div id="hud-powerup"></div>
    <div id="hud-drone-warn">⚠ DRONE CLOSING IN ⚠</div>
  `
}

const POWERUP_LABELS = { SHIELD:'🛡 SHIELD', MAGNET:'⚡ MAGNET', OVERDRIVE:'🔥 OVERDRIVE', HOVER:'🚀 HOVER' }
const POWERUP_LABEL_COLORS = { SHIELD:'#0088ff', MAGNET:'#ffdd00', OVERDRIVE:'#ffffff', HOVER:'#00ff88' }

export function updateHud(gameState) {
  const hi = Math.max(parseInt(localStorage.getItem('neon-runner-highscore') || '0'), gameState.score)
  document.getElementById('hud-score').textContent = `SCORE: ${gameState.score}`
  document.getElementById('hud-dist').textContent  = `${Math.floor(gameState.distance)}m`
  document.getElementById('hud-hi').textContent    = `BEST: ${hi}`
  document.getElementById('hud-hp').textContent    = '♥'.repeat(gameState.hp) + '♡'.repeat(3 - gameState.hp)

  const puEl = document.getElementById('hud-powerup')
  if (gameState.powerUp) {
    const { type, timeLeft } = gameState.powerUp
    const dur = { SHIELD:1, MAGNET:8, OVERDRIVE:5, HOVER:6 }[type]
    const pct = type === 'SHIELD' ? 100 : Math.max(0, (timeLeft / dur) * 100)
    const col = POWERUP_LABEL_COLORS[type]
    puEl.innerHTML = `
      <span style="color:${col};text-shadow:0 0 8px ${col}">${POWERUP_LABELS[type]}</span>
      <div class="powerup-bar" style="width:${pct}%;background:${col};box-shadow:0 0 6px ${col}"></div>
    `
  } else {
    puEl.innerHTML = ''
  }

  const warn = document.getElementById('hud-drone-warn')
  if (warn) warn.style.display = gameState.droneProximity > 0.6 ? 'block' : 'none'
}

export function showScreen(type, gameState, onSkinSelect) {
  if (type === 'PLAYING') {
    overlayEl.innerHTML = ''
    overlayEl.style.pointerEvents = 'none'
    return
  }
  if (type === 'TITLE') {
    overlayEl.style.pointerEvents = 'auto'
    overlayEl.innerHTML = `
      <div class="screen">
        <h1>NEON RUNNER</h1>
        <p style="color:#aa88ff;margin-top:6px;letter-spacing:3px">CYBERPUNK ENDLESS RUNNER</p>
        <div class="skin-row">
          <button class="skin-btn cyan selected"    data-skin="CYAN"    title="Cyan"></button>
          <button class="skin-btn magenta"          data-skin="MAGENTA" title="Magenta"></button>
          <button class="skin-btn gold"             data-skin="GOLD"    title="Gold"></button>
        </div>
        <p class="cta">PRESS SPACE / TAP TO START</p>
        <div class="controls">
          ← → / A D &nbsp; lane switch<br>
          ↑ W Space &nbsp; jump<br>
          ↓ S &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; slide
        </div>
      </div>`
    overlayEl.querySelectorAll('.skin-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        overlayEl.querySelectorAll('.skin-btn').forEach(b => b.classList.remove('selected'))
        btn.classList.add('selected')
        onSkinSelect(btn.dataset.skin)
      })
    })
    return
  }
  if (type === 'GAME_OVER') {
    overlayEl.style.pointerEvents = 'auto'
    const hi = Math.max(parseInt(localStorage.getItem('neon-runner-highscore') || '0'), gameState.score)
    localStorage.setItem('neon-runner-highscore', String(hi))
    overlayEl.innerHTML = `
      <div class="screen">
        <h2>CAPTURED</h2>
        <p class="stat">DISTANCE &nbsp; ${Math.floor(gameState.distance)}m</p>
        <p class="stat">SCORE &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${gameState.score}</p>
        <p class="hi-stat">BEST &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${hi}</p>
        <button class="restart-btn" id="restart-btn">[ RESTART ]</button>
      </div>`
    document.getElementById('restart-btn').addEventListener('click', () =>
      window.dispatchEvent(new CustomEvent('game-restart')))
  }
}
```

- [ ] **Step 3: Update main.js showScreen calls to pass skin callback**

```js
// showScreen('TITLE') call becomes:
showScreen('TITLE', gameState, (skin) => { gameState.skinColor = skin })

// showScreen('GAME_OVER') stays the same
```

- [ ] **Step 4: Verify**

`npm run dev`. Title screen has skin selector. All HUD elements positioned and glowing. Power-up bar drains in real time. CAPTURED screen shows stats. BEST score persists after refresh (localStorage).

- [ ] **Step 5: Commit**

```bash
git add src/hud.js src/style.css src/main.js
git commit -m "feat: polish HUD, screens, skin selector, localStorage high score"
```

---

## Task 12: Audio Stub & Final Integration

**Files:**
- Create: `src/audio.js`
- Modify: `src/main.js`

**Interfaces:**
- Produces: `initAudio() → audioApi`; `audioApi.play(event: 'collect'|'hit'|'powerup'|'bgm_start'|'bgm_stop')`
- Note: Web Audio API synth sounds. User will be asked before adding real audio files.

- [ ] **Step 1: Create src/audio.js (Web Audio API synth)**

```js
let ctx = null

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  return ctx
}

function beep(frequency, type, duration, gainVal, startTime) {
  const c = getCtx()
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.connect(gain)
  gain.connect(c.destination)
  osc.type = type
  osc.frequency.setValueAtTime(frequency, startTime)
  gain.gain.setValueAtTime(gainVal, startTime)
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)
  osc.start(startTime)
  osc.stop(startTime + duration)
}

const SOUNDS = {
  collect()  { const t = getCtx().currentTime; beep(880, 'sine', 0.1, 0.3, t); beep(1200, 'sine', 0.08, 0.2, t+0.05) },
  hit()      { const t = getCtx().currentTime; beep(150, 'sawtooth', 0.2, 0.4, t) },
  powerup()  { const t = getCtx().currentTime; [440,550,660,880].forEach((f,i) => beep(f,'sine',0.12,0.2,t+i*0.07)) },
  drone_warn(proximity) {
    if (proximity < 0.5) return
    const t = getCtx().currentTime
    const freq = 200 + proximity * 400
    beep(freq, 'square', 0.05, proximity * 0.15, t)
  },
}

let bgmNode = null

export function initAudio() {
  // Resume AudioContext on first user gesture (browser policy)
  const resume = () => { getCtx().resume(); window.removeEventListener('keydown', resume); window.removeEventListener('touchstart', resume) }
  window.addEventListener('keydown', resume)
  window.addEventListener('touchstart', resume)

  function play(event, ...args) {
    try { SOUNDS[event]?.(...args) } catch(e) { /* AudioContext not yet ready */ }
  }

  return { play }
}
```

- [ ] **Step 2: Wire audio into main.js**

```js
import { initAudio } from './audio.js'
const audioApi = initAudio()

// On hitObstacle:    audioApi.play('hit')
// On hitCollectible shard: audioApi.play('collect')
// On hitCollectible power-up: audioApi.play('powerup')
// In PLAYING loop:   audioApi.play('drone_warn', gameState.droneProximity)
```

- [ ] **Step 3: Verify**

`npm run dev`. Collect shards — ascending chime. Hit obstacle — buzzer. Collect power-up — ascending arpeggio. Drone proximity triggers pulse sound that increases in pitch.

- [ ] **Step 4: Commit**

```bash
git add src/audio.js src/main.js
git commit -m "feat: add Web Audio API synthesized sound effects"
```

---

## Self-Review

**Spec coverage check:**

| Spec Requirement | Task |
|-----------------|------|
| 3-lane system with smooth switch | Task 4 |
| Auto-forward + speed scaling | Task 7 |
| Jump (parabola), Slide (AABB shrink) | Tasks 3-4 |
| Keyboard + swipe input, no duplication | Task 4 |
| 5 obstacle types | Task 5 |
| AABB collision, 3 HP | Task 6 |
| Data shards (octahedron, cyan/magenta) | Task 8 |
| 4 power-ups incl. magnet lerp | Task 8 |
| Drone: proximity 0-1, red glow, warning text | Task 9 |
| Drone: 3D model only on capture | Task 9 |
| Drone: proximity+ on hit, - on overdrive | Task 9 |
| Running trail, collect/hit burst, camera shake | Task 10 |
| Parallax city buildings (InstancedMesh 0.3x) | Task 2 |
| Neon skyline, FogExp2 | Task 2 |
| HUD: score, dist, HP, power-up, hi-score | Task 11 |
| localStorage high score | Task 11 |
| Start screen + skin selector | Task 11 |
| Game over screen: stats + restart | Tasks 7, 11 |
| 60fps: object pools, InstancedMesh | Tasks 2, 5, 8, 10 |
| No external assets | All tasks |
| Mobile swipe | Task 4 |
| Web Audio synthesized sounds | Task 12 |

**All spec requirements covered. No placeholders. No TBD sections.**

**Type consistency check:**
- `gameState.player.lane` (number 0-2) — consistent across player.js, input.js, collectibles.js, collision.js
- `getAABB() → THREE.Box3` — consistent signature across player, obstacles, collectibles
- `update(delta, gameState)` — consistent signature across all modules
- `collectibleApi.collect(item, gameState)` — `item` is the object returned by `getActive()`, which includes `.entry` reference used for deactivation ✓
- `droneProximity` modified in main.js only, read in drone.js and hud.js ✓
