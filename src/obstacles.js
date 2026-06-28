import * as THREE from 'three'
import { LANES } from './constants.js'
import { OBSTACLE_VARIANTS, calcSpinnerAABB, tickChargerBot } from './obstacle-types.js'

const POOL_SIZE = 24
const SPAWN_Z = -55
const RECYCLE_Z = 12
const BASE_INTERVAL = 2.2
const MIN_INTERVAL = 0.6

export function initObstacles(scene, chargeWarnEl) {
  const allEntries = []
  for (const [mechanic, variants] of Object.entries(OBSTACLE_VARIANTS)) {
    for (const factory of variants) {
      allEntries.push({ mechanic, factory })
    }
  }

  const pool = []
  for (let i = 0; i < POOL_SIZE; i++) {
    const { mechanic, factory } = allEntries[i % allEntries.length]
    const obj = factory()
    obj.visible = false
    scene.add(obj)
    pool.push({ obj, active: false, mechanic })
  }

  let spawnTimer = 1.0
  let lastLane = -1
  let lastSpawnWasWide = false
  let recentChargerCount = 0
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

  function spawnOne(gameState) {
    const dist = gameState.distance
    let mechanic

    const wideOK = dist >= 600 && !lastSpawnWasWide
    if (wideOK && Math.random() < 0.15) {
      mechanic = Math.random() < 0.5 ? 'WIDE_WALL' : 'WIDE_HURDLE'
      lastSpawnWasWide = true
    } else {
      lastSpawnWasWide = false
      const available = Object.keys(OBSTACLE_VARIANTS).filter(t =>
        t !== 'WIDE_WALL' && t !== 'WIDE_HURDLE' &&
        (t !== 'SPINNER_BOT' || dist >= 1000) &&
        (t !== 'CHARGER_BOT' || dist >= 1000) &&
        (t !== 'CHARGER_BOT' || recentChargerCount <= 0)
      )
      mechanic = available[Math.floor(Math.random() * available.length)]
    }

    let entry = pool.find(p => !p.active && p.mechanic === mechanic)
    if (!entry) return

    const isWide = mechanic === 'WIDE_WALL' || mechanic === 'WIDE_HURDLE'
    if (isWide) {
      const pair = Math.random() < 0.5 ? [0, 1] : [1, 2]
      const x = (LANES[pair[0]] + LANES[pair[1]]) / 2
      entry.obj.position.set(x, 0, SPAWN_Z)
    } else {
      let lane
      do { lane = Math.floor(Math.random() * 3) } while (lane === lastLane && Math.random() > 0.3)
      lastLane = lane
      entry.obj.position.set(LANES[lane], 0, SPAWN_Z)
    }

    entry.obj.userData.baseX = entry.obj.position.x

    const type = entry.obj.userData.type
    if (type === 'PATROL_BOT') {
      entry.obj.userData.patrolDir = Math.random() > 0.5 ? 1 : -1
      entry.obj.userData.time = 0
    }
    if (type === 'LASER_GATE') entry.obj.userData.blinkTimer = 0
    if (type === 'HOLOGRAM_SIGN') {
      entry.obj.userData.time = 0
      entry.obj.userData.glitchTimer = 1.2 + Math.random() * 0.8
    }
    if (type === 'NEON_PIPE') entry.obj.userData.time = 0
    if (type === 'GAP') entry.obj.userData.time = 0
    if (type === 'SPINNER_BOT') {
      entry.obj.userData.spinAngle = 0
      entry.obj.userData.spinSpeed = 1.5 + gameState.distance * 0.0003
      entry.obj.userData.time = 0
      entry.obj.userData.hazardAABB = calcSpinnerAABB(0)
    }
    if (type === 'CHARGER_BOT') {
      entry.obj.userData.chargeState = 'APPROACH'
      entry.obj.userData.windupTimer = 0
      entry.obj.userData.chargeTimer = 0
      entry.obj.userData.time = 0
      recentChargerCount = 3
    }
    if (type === 'WIDE_WALL' || type === 'WIDE_HURDLE') {
      entry.obj.userData.time = 0
    }

    entry.obj.visible = true
    entry.active = true
  }

  function update(delta, gameState) {
    if (gameState.status !== 'PLAYING') return
    const speed = gameState.speed

    const interval = Math.max(MIN_INTERVAL, BASE_INTERVAL - gameState.distance * 0.0003)
    spawnTimer -= delta
    if (spawnTimer <= 0) {
      if (recentChargerCount > 0) recentChargerCount--
      spawnOne(gameState)
      spawnTimer = interval + (Math.random() - 0.5) * 0.4
    }

    pool.forEach(entry => {
      if (!entry.active) return
      const obj = entry.obj
      const type = obj.userData.type

      if (type === 'CHARGER_BOT') {
        const result = tickChargerBot(
          { chargeState: obj.userData.chargeState, windupTimer: obj.userData.windupTimer,
            chargeTimer: obj.userData.chargeTimer, time: obj.userData.time },
          delta, speed, obj.position.z
        )
        obj.userData.chargeState = result.newState.chargeState
        obj.userData.windupTimer = result.newState.windupTimer
        obj.userData.chargeTimer = result.newState.chargeTimer
        obj.userData.time = result.newState.time
        obj.position.z += result.dz
        obj.position.x = obj.userData.baseX + result.vibX
        // visual flash during WINDUP
        const botBody = obj.getObjectByName('chargerBody')
        if (botBody) {
          botBody.material.emissiveIntensity = obj.userData.chargeState === 'WINDUP'
            ? 2 + Math.sin(obj.userData.time * 20) * 1.5
            : 1.5
        }
        // show/hide charge warning HUD
        if (chargeWarnEl) chargeWarnEl.style.display = obj.userData.chargeState === 'WINDUP' ? 'block' : 'none'
      } else {
        obj.position.z += speed * delta
      }

      if (type === 'LASER_GATE') {
        obj.userData.blinkTimer += delta
        const beam = obj.getObjectByName('beam')
        const beam2 = obj.getObjectByName('beam2')
        if (beam) beam.visible = Math.sin(obj.userData.blinkTimer * 6) > 0
        if (beam2) beam2.visible = beam ? beam.visible : false
      }

      if (type === 'HOLOGRAM_SIGN') {
        obj.userData.time += delta
        obj.userData.glitchTimer -= delta
        const panel = obj.getObjectByName('signPanel')
        if (panel) {
          if (obj.userData.glitchTimer <= 0) {
            panel.material.emissiveIntensity = 0.05
            obj.userData.glitchTimer = 1.2 + Math.random() * 0.8
          } else {
            panel.material.emissiveIntensity = 1.5 + 0.4 * Math.sin(obj.userData.time * 6)
          }
        }
      }

      if (type === 'PATROL_BOT') {
        obj.userData.time += delta
        obj.position.x += obj.userData.patrolDir * obj.userData.patrolSpeed * delta
        if (obj.position.x > LANES[2] + 1) obj.userData.patrolDir = -1
        if (obj.position.x < LANES[0] - 1) obj.userData.patrolDir = 1
        const botBody = obj.getObjectByName('botBody')
        const botHead = obj.getObjectByName('botHead')
        if (botBody) {
          const baseY = obj.userData.bodyBaseY ?? 0.5
          botBody.position.y = baseY + 0.08 * Math.sin(obj.userData.time * 5)
          if (botHead) botHead.position.y = botBody.position.y + 0.5
        } else if (botHead) {
          botHead.position.y = (obj.userData.bodyBaseY ?? 0.5) + 0.5
        }
        obj.rotation.z = obj.userData.patrolDir * 0.06 * Math.sin(obj.userData.time * 5)
      }

      if (type === 'NEON_PIPE') {
        obj.userData.time += delta
        const pipe = obj.getObjectByName('pipe')
        if (pipe) pipe.material.emissiveIntensity = 1.5 + 0.8 * Math.sin(obj.userData.time * 4)
      }

      if (type === 'GAP') {
        obj.userData.time += delta
        const gapEdge = obj.getObjectByName('gapEdge')
        if (gapEdge) gapEdge.material.emissiveIntensity = 4 + 2 * Math.abs(Math.sin(obj.userData.time * 3))
      }

      if (type === 'WIDE_HURDLE') {
        obj.userData.time += delta
        const pipe = obj.getObjectByName('pipe')
        if (pipe) pipe.material.emissiveIntensity = 2 + 1.5 * Math.abs(Math.sin(obj.userData.time * 5))
      }

      if (type === 'SPINNER_BOT') {
        obj.userData.spinAngle += delta * obj.userData.spinSpeed
        const spinArm = obj.getObjectByName('spinArm')
        if (spinArm) spinArm.rotation.z = obj.userData.spinAngle
        obj.userData.hazardAABB = calcSpinnerAABB(obj.userData.spinAngle)
        // Strobe: red flash when arm in danger zone (|cosA|>0.7), dims in safe window
        const strobe = obj.getObjectByName('strobe')
        if (strobe) {
          const cosA = Math.cos(obj.userData.spinAngle)
          const sinA = Math.sin(obj.userData.spinAngle)
          const inDanger = Math.abs(cosA) > 0.7
          // Color shifts: orange-red when arm sweeping low (jump!), cyan when arm sweeping high (slide!)
          const armHigh = sinA > 0.5
          strobe.material.emissive.setHex(armHigh ? 0x00ffff : 0xff2200)
          strobe.material.emissiveIntensity = inDanger ? 4 : 0.5
        }
      }

      if (obj.position.z > RECYCLE_Z) {
        obj.visible = false
        entry.active = false
        if (type === 'CHARGER_BOT') {
          if (chargeWarnEl) chargeWarnEl.style.display = 'none'
        }
      }
    })
  }

  function reset() {
    pool.forEach(entry => { entry.obj.visible = false; entry.active = false })
    spawnTimer = 1.0
    lastLane = -1
    lastSpawnWasWide = false
    recentChargerCount = 0
    if (chargeWarnEl) chargeWarnEl.style.display = 'none'
  }

  return { update, getActive, reset }
}
