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
  // Power-up slots (4, one per type)
  POWERUP_TYPES.forEach(type => {
    const mesh = makePowerUpMesh(type)
    mesh.visible = false
    mesh.userData.type = type
    scene.add(mesh)
    pool.push({ mesh, active: false })
  })

  let shardTimer = 0
  let powerUpTimer = POWERUP_SPAWN_INTERVAL * 0.5  // first at 4s

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
      gameState.shardBonus += 10
    } else {
      // Power-up
      const duration = POWERUP_DURATIONS[item.type]
      gameState.powerUp = { type: item.type, timeLeft: duration }
      if (item.type === 'OVERDRIVE') {
        gameState.droneProximity = Math.max(0, gameState.droneProximity - 0.4)
      }
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

    // Power-up duration countdown (SHIELD is one-time, not time-based)
    if (gameState.powerUp && gameState.powerUp.type !== 'SHIELD') {
      gameState.powerUp.timeLeft -= delta
      if (gameState.powerUp.timeLeft <= 0) gameState.powerUp = null
    }

    pool.forEach(entry => {
      if (!entry.active) return
      const mesh = entry.mesh

      mesh.position.z += gameState.speed * delta
      mesh.rotation.y += delta * 2

      // MAGNET: pull shards toward player's current lane X
      if (gameState.powerUp?.type === 'MAGNET' && mesh.userData.type === 'SHARD') {
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
