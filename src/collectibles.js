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
    entry.mesh.userData.time = 0
    entry.mesh.visible = true
    entry.active = true
  }

  function collect(item, gameState) {
    item.entry.mesh.visible = false
    item.entry.active = false
    if (item.type === 'SHARD') {
      gameState.combo = Math.min(4, gameState.combo + 1)
      gameState.comboTimer = 0
      gameState.shardBonus += 10 * gameState.combo
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

    gameState.comboTimer += delta
    if (gameState.comboTimer > 2.0) {
      gameState.combo = 1
      gameState.comboTimer = 0
    }

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
