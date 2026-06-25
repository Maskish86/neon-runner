import * as THREE from 'three'
import { BASE_SPEED, MAX_SPEED, ACCEL_FACTOR, JUMP_VELOCITY, SLIDE_DURATION, INVINCIBLE_DURATION } from './constants.js'
import { initScene } from './scene.js'
import { initPlayer } from './player.js'
import { initInput } from './input.js'
import { initObstacles } from './obstacles.js'
import { checkCollisions } from './collision.js'
import { initHud, updateHud, showScreen } from './hud.js'

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

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

// --- Modules ---
const { updateScene } = initScene(scene)
const collectibleApiStub = { getActive: () => [], update() {}, reset() {} }

function makeGameState(skinColor = 'CYAN') {
  return {
    status: 'TITLE',
    score: 0, distance: 0, speed: BASE_SPEED, hp: 3,
    skinColor,
    player: {
      lane: 1, targetLane: 1, laneT: 1,
      action: 'RUNNING', queuedLane: null,
      yPos: 0, yVelocity: 0,
      slideTimer: 0, invincibleTimer: 0,
    },
    powerUp: null,
    droneProximity: 0,
  }
}

let gameState = makeGameState()
let playerApi = initPlayer(scene, gameState.skinColor)
let obstacleApi = initObstacles(scene)

initHud()
showScreen('TITLE', gameState)

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
  gameState = makeGameState(gameState.skinColor)
  playerApi = initPlayer(scene, gameState.skinColor)
  gameState.status = 'PLAYING'
  showScreen('PLAYING', gameState)
})

// --- Loop ---
let last = performance.now()
renderer.setAnimationLoop(() => {
  const now = performance.now()
  const delta = Math.min((now - last) / 1000, 0.05)
  last = now

  if (gameState.status === 'PLAYING') {
    gameState.distance += gameState.speed * delta
    gameState.speed = Math.min(MAX_SPEED, BASE_SPEED + gameState.distance * ACCEL_FACTOR)
    gameState.score = Math.floor(gameState.distance)

    updateScene(delta, gameState.speed)
    playerApi.update(delta, gameState)
    obstacleApi.update(delta, gameState)

    const { hitObstacle } = checkCollisions(playerApi, obstacleApi, collectibleApiStub, gameState)
    if (hitObstacle) {
      gameState.hp -= 1
      gameState.player.invincibleTimer = INVINCIBLE_DURATION
      gameState.droneProximity = Math.min(1, gameState.droneProximity + 0.3)
      if (gameState.hp <= 0) {
        gameState.status = 'GAME_OVER'
        showScreen('GAME_OVER', gameState)
      }
    }

    updateHud(gameState)
  } else if (gameState.status === 'TITLE') {
    updateScene(delta, 4)
  }

  renderer.render(scene, camera)
})
