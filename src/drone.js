import * as THREE from 'three'
import { BEAM_LOW_Y, BEAM_HIGH_Y } from './constants.js'

export function pickBeamInterval(distance) {
  let min, max
  if (distance < 1000)      { min = 40; max = 60 }
  else if (distance < 3000) { min = 28; max = 48 }
  else                      { min = 20; max = 36 }
  return min + Math.random() * (max - min)
}

export function beamHitsPlayer(beamType, playerYPos, playerAction) {
  if (beamType === 'LOW')  return playerYPos < BEAM_LOW_Y
  if (beamType === 'HIGH') return playerAction !== 'SLIDING'
  return false
}

function buildDroneMesh() {
  const group = new THREE.Group()
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff0000, emissiveIntensity: 2, metalness: 0.9 })
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.8), bodyMat)
  group.add(body)
  ;[-0.7, 0.7].forEach(x => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.08), bodyMat)
    arm.position.set(x, 0, 0)
    group.add(arm)
    const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 8), bodyMat)
    rotor.position.set(x, 0.1, 0)
    rotor.name = 'rotor'
    group.add(rotor)
  })
  group.visible = false
  return { group, bodyMat }
}

function buildBeamMesh(color, y) {
  const mat = new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: 3,
    transparent: true, opacity: 0.9,
  })
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(40, 0.12, 0.3), mat)
  mesh.position.set(0, y, 0)
  mesh.visible = false
  return mesh
}

export function initDrone(scene) {
  const { group: droneGroup, bodyMat: droneMat } = buildDroneMesh()
  scene.add(droneGroup)

  const lowBeam  = buildBeamMesh(0xff2200, BEAM_LOW_Y)
  const highBeam = buildBeamMesh(0x0066ff, BEAM_HIGH_Y)
  scene.add(lowBeam)
  scene.add(highBeam)

  const warnEl = document.createElement('div')
  warnEl.id = 'drone-beam-warn'
  warnEl.style.cssText = [
    'position:absolute', 'top:80px', 'left:50%', 'transform:translateX(-50%)',
    'padding:8px 28px', 'border-radius:4px', 'font-family:monospace',
    'font-size:22px', 'font-weight:bold', 'letter-spacing:3px',
    'display:none', 'text-align:center', 'color:#fff',
  ].join(';')
  // phase: 'IDLE' | 'WARNING' | 'BEAM' | 'COOLDOWN'
  let phase = 'IDLE'
  let phaseTimer = 0
  let attackTimer = 0
  let nextInterval = 48   // first beam at 48s
  let beamType = 'LOW'    // alternates each attack
  let blinkStep = 0   // 0–5: ON/OFF × 3 beats
  let stepTimer = 0

  function startWarning() {
    phase = 'WARNING'
    blinkStep = 0
    stepTimer = 0
    droneGroup.position.set(0, 5, 0)
    droneGroup.visible = true
    if (!warnEl.parentElement) document.getElementById('hud').appendChild(warnEl)
    warnEl.style.display = 'block'
    if (beamType === 'LOW') {
      droneMat.emissive.setHex(0xff2200)
      warnEl.innerHTML = '<span class="beam-arrow beam-arrow-up">↑</span> JUMP <span class="beam-arrow beam-arrow-up" style="animation-delay:0.15s">↑</span>'
      warnEl.style.background = 'rgba(200,20,0,0.85)'
      warnEl.style.boxShadow = '0 0 20px #ff2200'
    } else {
      droneMat.emissive.setHex(0x0066ff)
      warnEl.innerHTML = '<span class="beam-arrow beam-arrow-down">↓</span> SLIDE <span class="beam-arrow beam-arrow-down" style="animation-delay:0.15s">↓</span>'
      warnEl.style.background = 'rgba(0,60,200,0.85)'
      warnEl.style.boxShadow = '0 0 20px #0066ff'
    }
  }

  function update(delta, gameState) {
    if (gameState.status !== 'PLAYING') return { beamHit: false, warningStarted: false, beamType }

    gameState.droneBeamActive = phase === 'WARNING' || phase === 'BEAM'
    droneGroup.children.filter(c => c.name === 'rotor').forEach(r => r.rotation.y += delta * 20)

    if (phase === 'IDLE') {
      attackTimer += delta
      if (attackTimer >= nextInterval) {
        attackTimer = 0
        startWarning()
        return { beamHit: false, warningStarted: true, beamType }
      }
      return { beamHit: false, warningStarted: false, beamType }
    }

    if (phase !== 'WARNING') phaseTimer -= delta

    if (phase === 'WARNING') {
      stepTimer += delta
      if (stepTimer >= 0.25) {
        stepTimer -= 0.25
        blinkStep++
        warnEl.style.opacity = blinkStep % 2 === 0 ? '1' : '0'
        if (blinkStep >= 6) {
          phase = 'BEAM'
          phaseTimer = 0.5
          warnEl.style.opacity = '1'
          warnEl.style.display = 'none'
          const beam = beamType === 'LOW' ? lowBeam : highBeam
          beam.visible = true
          beam.material.opacity = 0.9
        }
      }
      return { beamHit: false, warningStarted: false, beamType }
    }

    if (phase === 'BEAM') {
      const beam = beamType === 'LOW' ? lowBeam : highBeam
      beam.material.emissiveIntensity = 3 + Math.sin(phaseTimer * 40) * 1.5

      const beamHit = gameState.player.invincibleTimer <= 0
        && gameState.powerUp?.type !== 'HOVER'
        && beamHitsPlayer(beamType, gameState.player.yPos, gameState.player.action)

      if (phaseTimer <= 0) {
        phase = 'COOLDOWN'
        phaseTimer = 0.5
      }
      return { beamHit, warningStarted: false, beamType }
    }

    if (phase === 'COOLDOWN') {
      const beam = beamType === 'LOW' ? lowBeam : highBeam
      beam.material.opacity = Math.max(0, (phaseTimer / 0.5) * 0.9)
      if (phaseTimer <= 0) {
        beam.visible = false
        droneGroup.visible = false
        phase = 'IDLE'
        beamType = beamType === 'LOW' ? 'HIGH' : 'LOW'
        nextInterval = pickBeamInterval(gameState.distance)
      }
    }

    return { beamHit: false, warningStarted: false, beamType }
  }

  function reset() {
    phase = 'IDLE'
    phaseTimer = 0
    attackTimer = 0
    nextInterval = 48
    blinkStep = 0
    stepTimer = 0
    beamType = 'LOW'
    droneGroup.visible = false
    lowBeam.visible = false
    highBeam.visible = false
    droneMat.emissive.setHex(0xff2200)
    warnEl.style.opacity = '1'
    warnEl.style.display = 'none'
  }

  return { update, reset }
}
