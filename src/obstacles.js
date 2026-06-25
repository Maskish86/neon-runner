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
