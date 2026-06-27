import * as THREE from 'three'
import {
  LANES, SKIN_COLORS, LANE_SWITCH_DURATION,
  JUMP_VELOCITY, GRAVITY, SLIDE_DURATION, INVINCIBLE_DURATION
} from './constants.js'

function buildHumanoid(colors) {
  const group = new THREE.Group()
  const mat = (emissiveIntensity = 1) => new THREE.MeshStandardMaterial({
    color: colors.main,
    emissive: colors.emissive,
    emissiveIntensity,
    roughness: 0.3,
    metalness: 0.6,
  })

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), mat(0.6))
  head.position.y = 1.6
  head.name = 'head'

  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.08, 0.05),
    new THREE.MeshStandardMaterial({
      color: colors.emissive,
      emissive: colors.emissive,
      emissiveIntensity: 1.5,
      roughness: 0,
      metalness: 1,
    })
  )
  visor.position.set(0, -0.04, 0.22)
  visor.name = 'visor'
  head.add(visor)

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.3), mat(0.5))
  torso.position.y = 1.1
  torso.name = 'torso'

  const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 0.15), mat(0.3))
  lArm.position.set(-0.35, 1.05, 0)
  lArm.name = 'lArm'
  const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 0.15), mat(0.3))
  rArm.position.set(0.35, 1.05, 0)
  rArm.name = 'rArm'

  const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.18), mat(0.4))
  lLeg.position.set(-0.15, 0.5, 0)
  lLeg.name = 'lLeg'
  const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.18), mat(0.4))
  rLeg.position.set(0.15, 0.5, 0)
  rLeg.name = 'rLeg'

  group.add(head, torso, lArm, rArm, lLeg, rLeg)

  const bubble = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 12, 12),
    new THREE.MeshStandardMaterial({
      color: 0x0044ff,
      emissive: 0x0088ff,
      emissiveIntensity: 1,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    })
  )
  bubble.position.y = 0.9
  bubble.name = 'shieldBubble'
  bubble.visible = false
  group.add(bubble)

  return group
}

export function initPlayer(scene, skinColor = 'CYAN') {
  const colors = SKIN_COLORS[skinColor]
  const group = buildHumanoid(colors)
  group.position.set(LANES[1], 0, 0)
  scene.add(group)

  const box3 = new THREE.Box3()

  // Running leg animation state
  let legAngle = 0

  function getAABB() {
    // Compute from group position; player Y offset already in group.position.y
    const h = group.scale.y < 1 ? 0.9 : 1.8  // slide = half height
    const px = group.position.x
    const py = group.position.y
    box3.min.set(px - 0.28, py, -0.25)
    box3.max.set(px + 0.28, py + h, 0.25)
    return box3
  }

  function update(delta, gs) {
    const p = gs.player

    // --- Lane lerp ---
    if (p.action === 'LANE_SWITCH') {
      p.laneT += delta / LANE_SWITCH_DURATION
      if (p.laneT >= 1) {
        p.laneT = 1
        p.lane = p.targetLane
        // Consume queued input
        if (p.queuedLane !== null && p.queuedLane !== p.lane) {
          p.targetLane = p.queuedLane
          p.queuedLane = null
          p.laneT = 0
        } else {
          p.action = 'RUNNING'
          p.queuedLane = null
        }
      }
      const fromX = LANES[p.lane]
      const toX = LANES[p.targetLane]
      group.position.x = THREE.MathUtils.lerp(fromX, toX, p.laneT)
    } else {
      group.position.x = LANES[p.lane]
    }

    // --- HOVER lift ---
    if (gs.powerUp?.type === 'HOVER' && p.action !== 'JUMPING') {
      p.yPos = 1.5
      p.yVelocity = 0
      group.position.y = 1.5
    } else if (p.action !== 'JUMPING' && p.yPos > 0) {
      // HOVER expired while airborne — begin falling
      p.action = 'JUMPING'
      p.yVelocity = 0
    } else if (p.action === 'JUMPING') {
      // --- Jump physics ---
      p.yVelocity += GRAVITY * delta
      p.yPos += p.yVelocity * delta
      if (p.yPos <= 0) {
        p.yPos = 0
        p.yVelocity = 0
        p.action = 'RUNNING'
      }
      group.position.y = p.yPos
    } else {
      group.position.y = p.yPos
    }

    // --- Slide scale ---
    if (p.action === 'SLIDING') {
      p.slideTimer -= delta
      group.scale.y = 0.5
      group.position.y = 0
      if (p.slideTimer <= 0) {
        p.action = 'RUNNING'
        group.scale.y = 1
      }
    } else if (p.action !== 'JUMPING') {
      group.scale.y = 1
    }

    // --- Invincibility blink ---
    if (p.invincibleTimer > 0) {
      p.invincibleTimer -= delta
      group.visible = Math.floor(p.invincibleTimer / 0.08) % 2 === 0
      if (p.invincibleTimer <= 0) group.visible = true
    }

    // --- Leg animation + arm swing ---
    if (gs.status === 'PLAYING') {
      legAngle += delta * 8
      const lLeg = group.getObjectByName('lLeg')
      const rLeg = group.getObjectByName('rLeg')
      const lArm = group.getObjectByName('lArm')
      const rArm = group.getObjectByName('rArm')
      if (lLeg && rLeg) {
        lLeg.rotation.x = Math.sin(legAngle) * 0.5
        rLeg.rotation.x = -Math.sin(legAngle) * 0.5
      }
      if (lArm && rArm) {
        if (p.action === 'SLIDING') {
          lArm.rotation.x = -0.8
          rArm.rotation.x = -0.8
        } else {
          lArm.rotation.x = Math.sin(legAngle) * 0.4
          rArm.rotation.x = -Math.sin(legAngle) * 0.4
        }
      }
    }
    // --- Shield bubble ---
    const bubble = group.getObjectByName('shieldBubble')
    if (bubble) bubble.visible = gs.powerUp?.type === 'SHIELD'
  }

  return { group, update, getAABB }
}
