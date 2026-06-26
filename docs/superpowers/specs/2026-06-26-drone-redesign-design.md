# Drone Redesign: Independent Scan Beam Attacker

**Date:** 2026-06-26  
**Status:** Approved

## Problem

Current drone mechanic overlaps with the HP/heart system. Both punish the same action (hitting obstacles) and both lead to game over. The drone proximity meter is a second life counter with visual flair — not a distinct mechanic.

## Goal

Give the drone an independent role: a separate threat layer that operates on its own clock, unrelated to obstacle avoidance.

## Design

### System Changes

**Removed:**
- `gameState.droneProximity`
- `calcProximityDelta()` and all proximity logic in `main.js`
- `droneApi.triggerCapture()` and capture animation
- `drone_warn` audio calls
- `.drone-glow` screen edge effect
- "⚠ DRONE CLOSING IN ⚠" HUD warning

**Added:**
- Independent attack timer in `drone.js` closure
- Two beam meshes (red LOW, blue HIGH)
- Warning UI: colored beam indicator + action icon
- Beam collision check in `main.js`
- Beam warning SE and beam hit SE

**Unchanged:**
- HP 3-heart system (sole game-over condition)
- Combo system
- Drone 3D mesh (repurposed: visible only during attacks)

### Beam Mechanics

Two beam types alternate (LOW → HIGH → LOW → …):

| Type | Height | Avoid by | Color | Icon |
|------|--------|----------|-------|------|
| LOW  | y=0.5  | JUMP     | Red   | ↑ JUMP |
| HIGH | y=1.5  | SLIDE    | Blue  | ↓ SLIDE |

**Collision logic:**
- Standing player (y=0–1.8): hit by both
- Jumping player (feet rise above y=0.5): avoids LOW, hit by HIGH
- Sliding player (max height y=0.9): avoids HIGH, hit by LOW

**Attack phases:**
1. **WARNING** (1.5s): Drone appears at top of screen; colored warning UI visible
2. **BEAM** (0.7s): Beam sweeps across screen; collision active
3. **COOLDOWN** (0.5s): Beam fades; drone exits

**Hit result:** HP-1 + combo reset. `invincibleTimer` applied so same beam can't hit twice.

### Difficulty Scaling

Attack interval determined by `gameState.distance`, random within range to prevent pattern memorization:

| Distance | Interval range |
|----------|---------------|
| 0–1000m  | 10–15s        |
| 1000–3000m | 7–12s       |
| 3000m+   | 5–9s          |

Beam speed and warning duration stay fixed — game speed increasing already makes later attacks feel faster.

## Files Affected

- `src/drone.js` — full rewrite of attack logic; remove `calcProximityDelta`, `triggerCapture`
- `src/main.js` — remove proximity logic; add beam collision check
- `src/hud.js` — remove proximity display if any
- `src/audio.js` — add beam warning and beam hit sounds
- `src/constants.js` — add beam height constants
- `tests/` — update `calcProximityDelta` test (function removed)
