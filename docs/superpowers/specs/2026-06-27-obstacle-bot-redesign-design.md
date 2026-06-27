# Obstacle & Bot Redesign

**Date:** 2026-06-27

## Goals

1. Existing obstacle visuals are too simple — redesign all 5 types with more geometric detail and shape variation
2. Each obstacle type gets 2–3 visual variants (same mechanics/AABB, different mesh)
3. Add 2-lane obstacles that block 2 of 3 lanes, forcing player to the remaining lane (rare)
4. Add 2 new bot types with novel avoidance mechanics not present in existing obstacles

---

## Architecture

### OBSTACLE_VARIANTS structure

Replace flat `OBSTACLE_FACTORIES` object with variant arrays per mechanic type:

```js
export const OBSTACLE_VARIANTS = {
  HOLOGRAM_SIGN: [factoryA, factoryB, factoryC],
  NEON_PIPE:     [factoryA, factoryB],
  GAP:           [factoryA, factoryB],
  LASER_GATE:    [factoryA, factoryB],
  PATROL_BOT:    [factoryA, factoryB, factoryC],
  WIDE_WALL:     [factoryA, factoryB],
  WIDE_HURDLE:   [factoryA, factoryB],
  SPINNER_BOT:   [factoryA],
  CHARGER_BOT:   [factoryA],
}
```

Each factory returns a Group with:
- `userData.type` — mechanic name (e.g. `'HOLOGRAM_SIGN'`) — unchanged, used by collision/HUD
- `userData.variant` — visual name (e.g. `'HOLOGRAM_SIGN_B'`) — for debugging

### Pool changes (obstacles.js)

Pre-build one slot per variant×type combo. Estimated 18 total slots; raise `POOL_SIZE` to 20.

Spawn logic:
```
1. Roll: 15% chance → 2-lane mode (distance > 600 only)
     Pick L0+L1 or L1+L2 randomly
     Pick WIDE_WALL or WIDE_HURDLE randomly
     Reject if lastSpawnWasWide === true
2. Normal mode:
     Pick mechanic type randomly (excluding WIDE types)
     Pick random variant within that type's array
     Apply lastLane avoidance as before
```

State resets in `spawnOne()` extended for new types.

---

## Existing Obstacle Redesigns

### HOLOGRAM_SIGN (avoidWith: JUMP)

**A — Redesigned:** Dual mounting posts at base, corner joints on frame, panel interior filled with UI elements (graphs, status bars, icons), double-layer frame with inner accent strip.

**B — Billboard:** Tall single panel on angled support pole, diagonal stripe pattern across panel surface, warning beacon on top.

**C — Double Panel:** Two stacked panels with neon band between them, each panel slightly angled outward.

All variants: `hazardAABB { minX: -0.9, maxX: 0.9, minY: 0, maxY: 1.9, minZ: -0.15, maxZ: 0.15 }`

---

### NEON_PIPE (avoidWith: SLIDE)

**A — Redesigned:** Central junction box, warning tape stripe wrapping the brackets, hex-bolt flanges at pipe ends, pressure gauge mesh above center.

**B — Pipe Cluster:** 3 thinner pipes bundled at slightly different heights; lowest pipe sets AABB height — same as current but visually denser.

**C — Valve Pipe:** Large valve wheels at both ends, central pressure indicator dial, pipe segments with visible welds.

All variants: `hazardAABB { minX: -1.3, maxX: 1.3, minY: 0.95, maxY: 1.45, minZ: -0.15, maxZ: 0.15 }`

---

### GAP (avoidWith: JUMP)

**A — Redesigned:** Broken concrete chunks on edges (small BoxGeometry pieces), depth indicator vertical markers on sides, heavy grid pattern on floor surface, more warning markings.

**B — Energy Chasm:** Blue-white glow emanating from below (emissive plane), thin semi-transparent fog box filling the gap, electric arc effect at edges.

All variants: `hazardAABB { minX: -1.2, maxX: 1.2, minY: -10, maxY: 0.05, minZ: -1.5, maxZ: 1.5 }`

---

### LASER_GATE (avoidWith: SLIDE)

**A — Redesigned:** Posts with heat sink fins, emitter sphere meshes at post tops, chevron warning markers on frame, beam emitter glow effect at beam origin points.

**B — Arch Gate:** Curved arch top instead of flat crossbar, beam unchanged in height and behavior.

All variants: `hazardAABB { minX: -1.1, maxX: 1.1, minY: 1.07, maxY: 1.23, minZ: -0.03, maxZ: 0.03 }`

---

### PATROL_BOT (avoidWith: LANE)

**A — Redesigned:** Leg/foot geometry added (currently body floats), chest sensor panel, arm stubs, head visor strip. Yellow color scheme retained.

**B — Slim Bot:** Tall narrow body, shoulder armor plates, green color scheme, taller head with single large eye.

**C — Heavy Bot:** Wide low body, short thick legs, orange color scheme, shoulder-mounted spotlights.

All variants: `hazardAABB { minX: -0.25, maxX: 0.25, minY: 0, maxY: 1.35, minZ: -0.2, maxZ: 0.2 }`

---

## 2-Lane Obstacles

### Placement rules

- Only adjacent lane pairs: `L0+L1` (x = −1.25) or `L1+L2` (x = 1.25)
- L0+L2 simultaneous is never used (no escape lane)
- Free lane when L0+L1 blocked: L2 (x = 2.5)
- Free lane when L1+L2 blocked: L0 (x = −2.5)
- Appear only when `distance > 600`
- No consecutive 2-lane obstacles (`lastSpawnWasWide` flag)
- Frequency: ~15% of spawns once distance threshold met

### WIDE_WALL (avoidWith: JUMP)

**A — Security Blast Door:** Heavy metal door spanning both lanes, yellow-black warning stripes on face, central warning light cluster, searchlight on top.

**B — Energy Barrier:** Semi-transparent force field mesh between two generator posts at lane edges, electric current effect running across surface.

`hazardAABB { minX: -1.45, maxX: 1.45, minY: 0, maxY: 1.9, minZ: -0.15, maxZ: 0.15 }`

### WIDE_HURDLE (avoidWith: SLIDE)

**A — Scanner Arm:** Support posts at each end, horizontal scan beam crossing at mid-height (~1.1), beam has subtle sweep animation (visual only, AABB is fixed).

**B — Gravity Floor Sensor:** Low-profile device mounted flush to ground, red scan line at 1.1 height, sensor housing with vents and indicator lights.

`hazardAABB { minX: -1.45, maxX: 1.45, minY: 0.95, maxY: 1.45, minZ: -0.15, maxZ: 0.15 }`

---

## New Bot Types

### SPINNER_BOT (avoidWith: TIMING)

**Concept:** Two arms extend from a small body along the X axis and rotate around the Z axis (sweeping in the YZ plane). Arm height changes continuously — player must JUMP when arms are low, SLIDE when arms are high. Two safe windows per rotation when arms point straight up or down.

**Visual:** Red-purple body, glowing sphere tips on each arm, warning strobe on body top.

**Mechanics:**
- Arm length: 0.6, body center Y: 0.7
- Rotation speed: 1.5 rad/s (~4s per revolution), increases slightly with distance
- `hazardAABB` updated every frame:
  - `arm_y = 0.7 + sin(spinAngle) * 0.6`
  - When `|cos(spinAngle)| < 0.3` (arms nearly vertical): set `minY: 99, maxY: 100` (collision disabled)
  - Otherwise: `minX: -0.65, maxX: 0.65, minY: arm_y - 0.08, maxY: arm_y + 0.08, minZ: -0.15, maxZ: 0.15`
- Spawn gate: `distance > 1000`

**State reset on spawn:** `spinAngle = 0`, `time = 0`

---

### CHARGER_BOT (avoidWith: LANE + TIMING)

**Concept:** 3-state machine. Approaches normally, stops with visible warning vibration, then charges at 5× speed. Player must change lane before the charge connects, or have already passed during the stop window.

**Visual:** Heavy forward-leaning bot, cyan color scheme, booster nozzles on chest, forward-swept shoulder guards.

**States:**
```
APPROACH  → normal obstacle speed, bot leans slightly forward
             WINDUP triggers when obj.position.z > -20
WINDUP    → velocity = 0, duration 0.5s
             body vibrates: position.x += sin(time * 30) * 0.03
             body flashes red, small HUD icon (⚡ CHARGE WARNING)
CHARGE    → position.z += speed * 5 * delta, duration 0.4s
             passes RECYCLE_Z naturally → auto-recycled
```

**Mechanics:**
- `hazardAABB`: fixed, same as PATROL_BOT
- HUD warning: small icon only (not full drone-level warning), appears during WINDUP
- Spawn gate: `distance > 1000`
- No consecutive CHARGER_BOT within 3 spawns

**State reset on spawn:** `chargeState = 'APPROACH'`, `windupTimer = 0`, `chargeTimer = 0`, `time = 0`

---

## Difficulty Scaling

| Element | Appears at distance |
|---|---|
| All existing types (variants) | 0 |
| 2-lane obstacles | > 600 |
| SPINNER_BOT | > 1000 |
| CHARGER_BOT | > 1000 |

Existing `BASE_INTERVAL → MIN_INTERVAL` ramp unchanged.

---

## Files Changed

| File | Change |
|---|---|
| `src/obstacle-types.js` | Full rewrite: `OBSTACLE_VARIANTS` structure, all variant factories |
| `src/obstacles.js` | Pool rebuild logic, spawn logic with 2-lane path, new bot update blocks |
| `src/constants.js` | No changes expected |
| `src/main.js` | Add CHARGER_BOT WINDUP HUD icon element |
| `src/style.css` | Style for charge warning icon |
