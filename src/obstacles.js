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
    // Pre-build pool cycling through types — no mesh rebuilds on spawn
    const type = OBSTACLE_TYPES[i % OBSTACLE_TYPES.length]
    const obj = OBSTACLE_FACTORIES[type]()
    obj.visible = false
    scene.add(obj)
    pool.push({ obj, active: false, type })
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
        const hz = p.obj.userData.hazardAABB
        const pos = p.obj.position
        box3.min.set(pos.x + hz.minX, hz.minY, pos.z + hz.minZ)
        box3.max.set(pos.x + hz.maxX, hz.maxY, pos.z + hz.maxZ)
        return box3
      },
    }))
  }

  function spawnOne() {
    const type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)]
    // Find free slot with matching type, fall back to any free slot
    let entry = pool.find(p => !p.active && p.type === type)
             ?? pool.find(p => !p.active)
    if (!entry) return

    // Reset per-spawn state without rebuilding the mesh
    if (entry.obj.userData.type === 'PATROL_BOT') {
      entry.obj.userData.patrolDir = Math.random() > 0.5 ? 1 : -1
    }
    if (entry.obj.userData.type === 'LASER_GATE') {
      entry.obj.userData.blinkTimer = 0
    }

    // Pick lane — avoid same lane twice in a row
    let lane
    do { lane = Math.floor(Math.random() * 3) } while (lane === lastLane && Math.random() > 0.3)
    lastLane = lane
    entry.obj.position.set(LANES[lane], 0, SPAWN_Z)
    entry.obj.visible = true
    entry.active = true
  }

  function update(delta, gameState) {
    if (gameState.status !== 'PLAYING') return
    const speed = gameState.speed

    // Spawn timer
    const interval = Math.max(MIN_INTERVAL, BASE_INTERVAL - gameState.distance * 0.0003)
    spawnTimer -= delta
    if (spawnTimer <= 0) {
      spawnOne()
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
