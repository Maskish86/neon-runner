import * as THREE from 'three'
import { BEAM_LOW_Y, BEAM_HIGH_Y } from './constants.js'

export function pickBeamInterval(distance) {
  let min, max
  if (distance < 1000)      { min = 10; max = 15 }
  else if (distance < 3000) { min = 7;  max = 12 }
  else                      { min = 5;  max = 9  }
  return min + Math.random() * (max - min)
}

export function beamHitsPlayer(beamType, playerYPos, playerAction) {
  if (beamType === 'LOW')  return playerYPos < BEAM_LOW_Y
  if (beamType === 'HIGH') return playerAction !== 'SLIDING'
  return false
}

// Pure function — testable without Three.js scene
export function calcProximityDelta({ hitObstacle, evaded, overdrive }, delta) {
  if (overdrive) return -0.4
  if (hitObstacle) return 0.3
  if (evaded) return -0.1
  return 0.002 * delta  // Slow passive creep
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
  return group
}

export function initDrone(scene) {
  const droneGroup = buildDroneMesh()
  scene.add(droneGroup)

  const glowEl = document.createElement('div')
  glowEl.className = 'drone-glow'
  document.getElementById('overlay').appendChild(glowEl)

  const warningEl = document.createElement('div')
  warningEl.style.cssText = `
    position:absolute;bottom:80px;left:50%;transform:translateX(-50%);
    color:#ff0044;font-family:monospace;font-size:16px;font-weight:bold;
    text-shadow:0 0 8px #ff0044;display:none;
  `
  warningEl.textContent = '⚠ DRONE CLOSING IN ⚠'
  document.getElementById('hud').appendChild(warningEl)

  let captureAnim = null

  function update(delta, gameState) {
    if (gameState.status !== 'PLAYING') return

    // Rotor spin
    droneGroup.children.filter(c => c.name === 'rotor').forEach(r => r.rotation.y += delta * 20)

    // Proximity glow
    const p = gameState.droneProximity
    const spread = Math.floor(p * 80)
    const alpha = p * 0.7
    glowEl.style.boxShadow = `inset 0 0 ${spread}px ${Math.floor(spread * 0.5)}px rgba(255,0,68,${alpha})`
    warningEl.style.display = p > 0.6 ? 'block' : 'none'
  }

  function triggerCapture(camera, gameState, onComplete) {
    droneGroup.position.set(0, 2, 15)
    droneGroup.visible = true
    const startY = droneGroup.position.y
    let t = 0
    captureAnim = (delta) => {
      t += delta
      droneGroup.position.z -= 12 * delta
      droneGroup.position.y = startY - t * 4
      if (t > 1.2) {
        droneGroup.visible = false
        captureAnim = null
        onComplete()
      }
    }
  }

  function updateCapture(delta) {
    if (captureAnim) captureAnim(delta)
  }

  function reset() {
    droneGroup.visible = false
    captureAnim = null
    const glowEl2 = document.querySelector('.drone-glow')
    if (glowEl2) glowEl2.style.boxShadow = 'none'
    warningEl.style.display = 'none'
  }

  return { update, triggerCapture, updateCapture, reset }
}
