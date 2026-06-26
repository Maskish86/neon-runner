# Visual Refresh Design — Neon Runner

**Date:** 2026-06-26  
**Scope:** Obstacles, collectibles, player — geometry + animation improvements (Approach B)  
**Files touched:** `src/obstacle-types.js`, `src/collectibles.js`, `src/player.js`  
**Files NOT touched:** `src/collision.js`, `src/constants.js`, `src/main.js`, `src/scene.js`

---

## Goals

Make obstacles, collectibles, and the player visually richer within the existing cyberpunk/neon aesthetic. Each object should read clearly at a glance and have at least one dynamic quality (animation, pulse, or flicker). No new dependencies — Three.js built-in geometries only.

## Constraints

- AABB hitboxes may be adjusted to match new geometry where it improves gameplay clarity, but collision logic in `collision.js` is unchanged.
- No custom GLSL shaders — all effects via JS-driven `emissiveIntensity`, rotation, and position updates.
- Existing pooling architecture in `obstacles.js` and `collectibles.js` is unchanged — factories return the same `{ group, userData }` shape.

---

## Obstacles (`src/obstacle-types.js`)

### HOLOGRAM_SIGN
**Geometry additions:**
- 4 thin edge bars forming a neon border frame (`BoxGeometry(2.4, 0.05, 0.05)` top/bottom, `BoxGeometry(0.05, 1.5, 0.05)` left/right), blue emissive
- 3 horizontal "text line" boxes inside (`BoxGeometry(1.8, 0.06, 0.05)`, spaced vertically), dim cyan

**Animation (in obstacles.js update loop, driven by `userData.time += delta`):**
- Main panel `emissiveIntensity`: `1.5 + 0.4 * Math.sin(userData.time * 6)`
- Random glitch: `userData.glitchTimer -= delta`; when ≤0, set intensity to 0.05 for one tick, reset timer to `1.2 + Math.random() * 0.8`
- Main panel mesh named `'signPanel'` in factory for update loop access

**AABB:** unchanged `{ minX: -0.9, maxX: 0.9, minY: 0.65, maxY: 1.9, minZ: -0.15, maxZ: 0.15 }`

### NEON_PIPE
**Geometry additions:**
- 2 end cap discs (`CylinderGeometry(0.18, 0.18, 0.05, 12)`) at both ends
- 2 support brackets (`BoxGeometry(0.06, 0.5, 0.06)`) hanging from pipe down toward ground

**Animation:**
- `emissiveIntensity` pulses: `1.5 + 0.8 * Math.sin(time * 4)`

**AABB:** unchanged

### GAP
**Geometry changes:**
- Edge strips replaced with brighter pulsing material (emissiveIntensity 4→6 pulse)
- Inner diagonal danger markers: 2 thin boxes crossing at 45° (`BoxGeometry(3.2, 0.04, 0.04)` rotated ±45°)

**AABB:** unchanged

### LASER_GATE
**Geometry changes:**
- Posts split into 3 segments: base cap (`BoxGeometry(0.14, 0.3, 0.14)`), mid column (`BoxGeometry(0.08, 1.8, 0.08)`), top cap (`BoxGeometry(0.14, 0.3, 0.14)`)
- Top crossbar: `BoxGeometry(2.2, 0.08, 0.08)` connecting tops of posts
- Secondary beam: thinner (`BoxGeometry(2.2, 0.03, 0.03)`) offset to `y = 1.1`, named `'beam2'`, blinking at opposite phase

**Animation (in obstacles.js update loop):**
- Primary `beam` blink unchanged: `Math.sin(blinkTimer * 6) > 0`
- Secondary `beam2`: `beam2.visible = !beam.visible`

**AABB:** adjusted to cover both beams `{ minX: -1.1, maxX: 1.1, minY: 1.07, maxY: 1.23, minZ: -0.03, maxZ: 0.03 }`

### PATROL_BOT
**Geometry additions:**
- Eyes: 2 `SphereGeometry(0.05, 6, 6)` meshes on head front face, red emissive (intensity 3)
- Antenna: `CylinderGeometry(0.02, 0.02, 0.3, 6)` + `SphereGeometry(0.04, 6, 6)` tip on head top
- **Name body mesh `'botBody'` and head mesh `'botHead'`** in factory so `obstacles.js` update loop can find them

**Animation (driven by `userData.time += delta` in obstacles.js update loop):**
- Bob: `botBody.position.y = 0.5 + 0.08 * Math.sin(userData.time * 5)`, botHead follows at `botBody.position.y + 0.5`
- Lean: `group.rotation.z = patrolDir * 0.06 * Math.sin(userData.time * 5)`

**AABB:** expanded slightly for antenna `{ minX: -0.25, maxX: 0.25, minY: 0, maxY: 1.35, minZ: -0.2, maxZ: 0.2 }`

---

## Collectibles (`src/collectibles.js`)

### SHARD
**Geometry:** Add inner core — `OctahedronGeometry(0.12)` child mesh, emissiveIntensity 4  
**Animation:** Multi-axis rotation: `mesh.rotation.y += delta * 2`, `mesh.rotation.x += delta * 1.3`

### Power-ups — distinct geometry per type

| Type | Geometry | Color | Emissive | Animation |
|------|----------|-------|----------|-----------|
| SHIELD | `TorusGeometry(0.35, 0.08, 8, 16)` | `0x0044ff` | `0x0088ff` | Y-axis spin + self-rotation on X |
| MAGNET | Two `CylinderGeometry(0.07, 0.07, 0.5, 8)` side-by-side (red + blue poles) in a group | `0xffaa00` / poles `0xff2200`+`0x2200ff` | gold | slow rotation |
| OVERDRIVE | `IcosahedronGeometry(0.4)` | `0xffffff` | `0xffffff` | fast spin (delta * 6) |
| HOVER | `OctahedronGeometry(0.4)` + `scale.y = 0.5` (flat gem) | `0x00ff44` | `0x00ff88` | bob + rotation |

All power-ups: floating bob via `userData.time += delta` in update loop. `mesh.position.y = 0.8 + 0.15 * Math.sin(mesh.userData.time * 3)`. Reset `userData.time = 0` at spawn.

MAGNET returns a `THREE.Group` (two cylinder children) instead of a single Mesh. The pool's `mesh` field holds this group — Three.js Group supports `.position`, `.rotation`, `.visible`, and `setFromObject`, so existing pool logic is unchanged.

---

## Player (`src/player.js`)

### Geometry additions

**Visor:** `BoxGeometry(0.35, 0.08, 0.05)` child of head, positioned at front face (`z = 0.22`, `y = 0`), same skin emissive color, intensity 3

**SHIELD bubble:** `SphereGeometry(0.9, 12, 12)` child of group, `MeshStandardMaterial({ color: 0x0044ff, transparent: true, opacity: 0.25, emissive: 0x0088ff, emissiveIntensity: 1 })`. Named `'shieldBubble'`. Shown only when `gs.powerUp?.type === 'SHIELD'`.

### Animation additions

**Arm swing** (added to existing `update()` leg-animation block):
```js
lArm.rotation.x = Math.sin(legAngle) * 0.4   // in phase with rLeg
rArm.rotation.x = -Math.sin(legAngle) * 0.4  // in phase with lLeg
```

**Slide arm pose:** when `p.action === 'SLIDING'`, set `lArm.rotation.x = rArm.rotation.x = -0.8` (arms reach forward)

**SHIELD bubble visibility:**
```js
const bubble = group.getObjectByName('shieldBubble')
if (bubble) bubble.visible = gs.powerUp?.type === 'SHIELD'
```

### Unchanged
- AABB: `±0.28 / h:1.8 or 0.9` — visor and bubble are visual-only
- Leg animation, invincibility blink, HOVER lift, slide scale

---

## Animation driver

Animations that need a running `time` value (hologram flicker, bot bob, power-up pulse) will use `mesh.userData.time += delta` inside the existing `update()` loops in `obstacles.js` and `collectibles.js`. No new module needed.

---

## Out of scope

- Particle effects on collect/hit (existing `particles.js` unchanged)
- Scene/skyline changes
- HUD changes
- New obstacle types
