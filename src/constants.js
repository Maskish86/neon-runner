// src/constants.js — created in Task 1, used everywhere
export const LANES = [-2.5, 0, 2.5]      // world X positions
export const BASE_SPEED = 12              // units/sec
export const MAX_SPEED = 22
export const ACCEL_FACTOR = 0.0008        // speed += distance * ACCEL_FACTOR per frame
export const LANE_SWITCH_DURATION = 0.15  // seconds
export const JUMP_VELOCITY = 10
export const GRAVITY = -22
export const SLIDE_DURATION = 0.6
export const INVINCIBLE_DURATION = 0.8
export const BEAM_LOW_Y = 0.5
export const BEAM_HIGH_Y = 1.5

export const SKIN_COLORS = {
  CYAN:    { emissive: 0x00ffff, main: 0x004466 },
  MAGENTA: { emissive: 0xff00ff, main: 0x440044 },
  GOLD:    { emissive: 0xffcc00, main: 0x443300 },
}

export const POWERUP_TYPES = ['SHIELD', 'MAGNET', 'OVERDRIVE', 'HOVER']
export const POWERUP_DURATIONS = { SHIELD: Infinity, MAGNET: 5, OVERDRIVE: 5, HOVER: 6 }

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
