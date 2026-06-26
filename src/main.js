import * as THREE from 'three'
import { BASE_SPEED, MAX_SPEED, ACCEL_FACTOR, JUMP_VELOCITY, SLIDE_DURATION, INVINCIBLE_DURATION } from './constants.js'
import { initScene } from './scene.js'
import { initPlayer } from './player.js'
import { initInput } from './input.js'
import { initObstacles } from './obstacles.js'
import { checkCollisions } from './collision.js'
import { initHud, updateHud, showScreen } from './hud.js'
import { initCollectibles } from './collectibles.js'
import { calcProximityDelta, initDrone } from './drone.js'
import { initParticles } from './particles.js'
import { initAudio } from './audio.js'

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
document.body.prepend(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0a0010)
scene.fog = new THREE.FogExp2(0x110022, 0.018)
scene.add(new THREE.AmbientLight(0x221133, 2))

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300)
camera.position.set(0, 4, 8)
camera.lookAt(0, 0, -10)

const CAM_BASE_X = 0
const CAM_BASE_Y = 4

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

// --- Modules ---
const { updateScene } = initScene(scene)
const collectibleApi = initCollectibles(scene)

function makeGameState(skinColor = 'CYAN') {
  return {
    status: 'TITLE',
    score: 0, shardBonus: 0, distance: 0, speed: BASE_SPEED, hp: 3,
    skinColor,
    player: {
      lane: 1, targetLane: 1, laneT: 1,
      action: 'RUNNING', queuedLane: null,
      yPos: 0, yVelocity: 0,
      slideTimer: 0, invincibleTimer: 0,
    },
    powerUp: null,
    droneProximity: 0,
    combo: 1,
    comboTimer: 0,
    timeScale: 1.0,
    slowTimer: 0,
    cameraShake: { intensity: 0, duration: 0 },
  }
}

let gameState = makeGameState()
let playerApi = initPlayer(scene, gameState.skinColor)
let obstacleApi = initObstacles(scene)
const droneApi = initDrone(scene)
const particleApi = initParticles(scene)
let captureTriggered = false

const audioApi = initAudio()

initHud()
showScreen('TITLE', gameState, (skin) => { gameState.skinColor = skin })

// --- Input ---
initInput(action => {
  if (gameState.status === 'TITLE' && (action === 'JUMP' || action === 'START')) {
    gameState.status = 'PLAYING'
    showScreen('PLAYING', gameState)
    return
  }
  if (gameState.status !== 'PLAYING') return
  const p = gameState.player
  if (action === 'LEFT') {
    const next = p.lane - 1; if (next < 0) return
    if (p.action === 'LANE_SWITCH') { p.queuedLane = next; return }
    p.targetLane = next; p.laneT = 0; p.action = 'LANE_SWITCH'
  } else if (action === 'RIGHT') {
    const next = p.lane + 1; if (next > 2) return
    if (p.action === 'LANE_SWITCH') { p.queuedLane = next; return }
    p.targetLane = next; p.laneT = 0; p.action = 'LANE_SWITCH'
  } else if (action === 'JUMP') {
    if (p.action !== 'JUMPING') { p.action = 'JUMPING'; p.yVelocity = JUMP_VELOCITY }
  } else if (action === 'SLIDE') {
    if (p.action !== 'JUMPING' && p.action !== 'SLIDING') {
      p.action = 'SLIDING'; p.slideTimer = SLIDE_DURATION
    }
  }
})

// --- Restart ---
window.addEventListener('game-restart', () => {
  scene.remove(playerApi.group)
  obstacleApi.reset()
  collectibleApi.reset()
  droneApi.reset()
  particleApi.reset()
  captureTriggered = false
  gameState = makeGameState(gameState.skinColor)
  gameState.powerUp = null
  playerApi = initPlayer(scene, gameState.skinColor)
  gameState.status = 'PLAYING'
  showScreen('PLAYING', gameState)
})

// --- Loop ---
let last = performance.now()
renderer.setAnimationLoop(() => {
  const now = performance.now()
  const realDelta = Math.min((now - last) / 1000, 0.05)
  last = now

  // slow-mo timer counts down in real time, not game time
  if (gameState.slowTimer > 0) {
    gameState.slowTimer -= realDelta
    if (gameState.slowTimer <= 0) {
      gameState.slowTimer = 0
      gameState.timeScale = 1.0
    }
  }
  const delta = realDelta * gameState.timeScale

  if (gameState.status === 'PLAYING') {
    gameState.distance += gameState.speed * delta
    gameState.speed = Math.min(MAX_SPEED, BASE_SPEED + gameState.distance * ACCEL_FACTOR)
    gameState.score = Math.floor(gameState.distance) + gameState.shardBonus

    updateScene(delta, gameState.speed)
    const prevYPos = gameState.player.yPos
    playerApi.update(delta, gameState)
    if (prevYPos > 0.05 && gameState.player.yPos <= 0 && gameState.player.action !== 'SLIDING') {
      gameState.cameraShake = { intensity: 0.06, duration: 0.1 }
    }
    obstacleApi.update(delta, gameState)
    collectibleApi.update(delta, gameState)

    const { hitObstacle, hitCollectible } = checkCollisions(playerApi, obstacleApi, collectibleApi, gameState)
    if (hitCollectible) {
      particleApi.burstCollect(hitCollectible.mesh.position.clone(),
        hitCollectible.type === 'SHARD' ? 0x00ffff : 0xffcc00)
      try { audioApi.play(hitCollectible.type === 'SHARD' ? 'collect' : 'powerup') } catch(e) {}
      collectibleApi.collect(hitCollectible, gameState)
    }
    if (hitObstacle) {
      if (gameState.powerUp?.type === 'SHIELD') {
        // SHIELD absorbs the hit — one-time use, grant invincibility so same obstacle can't re-hit
        gameState.powerUp = null
        gameState.player.invincibleTimer = INVINCIBLE_DURATION
        gameState.cameraShake = { intensity: 0.08, duration: 0.15 }
      } else {
        particleApi.burstHit(playerApi.group.position.clone())
        try { audioApi.play('hit') } catch(e) {}
        gameState.hp -= 1
        gameState.player.invincibleTimer = INVINCIBLE_DURATION
        gameState.timeScale = 0.25
        gameState.slowTimer = 0.2
        gameState.cameraShake = { intensity: 0.15, duration: 0.3 }
        if (gameState.hp <= 0) {
          gameState.status = 'GAME_OVER'
          showScreen('GAME_OVER', gameState)
        }
      }
    }

    const evaded = false  // passive decay + overdrive handles drone tension; per-frame signal overwhelmed delta
    const proxDelta = calcProximityDelta({
      hitObstacle,
      evaded,
      overdrive: gameState.powerUp?.type === 'OVERDRIVE',
    }, delta)
    gameState.droneProximity = Math.max(0, Math.min(1, gameState.droneProximity + proxDelta))
    try { audioApi.play('drone_warn', gameState.droneProximity) } catch(e) {}

    particleApi.update(delta, gameState, camera)
    droneApi.update(delta, gameState)
    droneApi.updateCapture(delta)

    if (gameState.droneProximity >= 1 && !captureTriggered) {
      captureTriggered = true
      gameState.hp = 0
      droneApi.triggerCapture(camera, gameState, () => {
        gameState.status = 'GAME_OVER'
        showScreen('GAME_OVER', gameState)
      })
    }

    // camera shake
    if (gameState.cameraShake.duration > 0) {
      camera.position.x = CAM_BASE_X + (Math.random() - 0.5) * gameState.cameraShake.intensity
      camera.position.y = CAM_BASE_Y + (Math.random() - 0.5) * gameState.cameraShake.intensity
      gameState.cameraShake.duration -= realDelta
      if (gameState.cameraShake.duration <= 0) {
        gameState.cameraShake.duration = 0
        camera.position.x = CAM_BASE_X
        camera.position.y = CAM_BASE_Y
      }
    }

    updateHud(gameState)
  } else if (gameState.status === 'TITLE') {
    updateScene(delta, 4)
  }

  renderer.render(scene, camera)
})
