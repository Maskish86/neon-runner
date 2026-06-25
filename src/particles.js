import * as THREE from 'three'

const PARTICLE_COUNT = 80
const TRAIL_COUNT = 20

// Local copy to avoid circular import
const LANES_LOCAL = [-2.5, 0, 2.5]

function makeParticleMat(color) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 })
}

export function initParticles(scene) {
  // Pool of tiny box particles for bursts
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
    trailPool.push({ mesh, life: 0, maxLife: 0.2 })
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
      p.mesh.scale.setScalar(1)
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

  function updateTrail(playerPos, isOverdrive, speed) {
    const p = trailPool[trailIdx % TRAIL_COUNT]
    p.mesh.position.set(
      playerPos.x + (Math.random() - 0.5) * 0.15,
      playerPos.y + 0.1 + Math.random() * 0.2,
      playerPos.z + 0.2,
    )
    p.mesh.material.color.set(isOverdrive ? 0xffffff : 0x00ffff)
    p.mesh.material.opacity = isOverdrive ? 1 : 0.7
    p.mesh.visible = true
    p.maxLife = isOverdrive ? 0.35 : 0.2
    p.life = p.maxLife
    trailIdx++
  }

  function update(delta, gameState, camera) {
    if (gameState.status !== 'PLAYING') return

    // Burst particles
    for (const p of pool) {
      if (!p.active) continue
      p.life -= delta
      p.mesh.position.addScaledVector(p.vel, delta)
      p.vel.y -= 8 * delta
      const t = Math.max(0, p.life / p.maxLife)
      p.mesh.material.opacity = t
      p.mesh.scale.setScalar(t)
      if (p.life <= 0) { p.mesh.visible = false; p.active = false }
    }

    // Trail
    const isOverdrive = gameState.powerUp?.type === 'OVERDRIVE'
    const playerPos = new THREE.Vector3(
      LANES_LOCAL[gameState.player.lane],
      gameState.player.yPos,
      0,
    )
    updateTrail(playerPos, isOverdrive, gameState.speed)

    for (const p of trailPool) {
      if (!p.mesh.visible) continue
      p.life -= delta
      p.mesh.material.opacity = Math.max(0, p.life / p.maxLife) * (isOverdrive ? 1 : 0.7)
      p.mesh.position.z += gameState.speed * delta * 0.3
      if (p.life <= 0) p.mesh.visible = false
    }

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
    for (const p of pool) { p.mesh.visible = false; p.active = false }
    for (const p of trailPool) { p.mesh.visible = false; p.life = 0 }
    shakeTime = 0
  }

  return { update, burstCollect, burstHit, reset }
}
