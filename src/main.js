import * as THREE from 'three'
import { initScene } from './scene.js'
import { initPlayer } from './player.js'
import { initInput } from './input.js'
import { initObstacles } from './obstacles.js'
import { JUMP_VELOCITY, SLIDE_DURATION } from './constants.js'

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
document.body.prepend(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0a0010)
scene.fog = new THREE.FogExp2(0x110022, 0.018)

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300)
camera.position.set(0, 4, 8)
camera.lookAt(0, 0, -10)

const { updateScene } = initScene(scene)

const ambient = new THREE.AmbientLight(0x221133, 2)
scene.add(ambient)

const gameState = {
  status: 'PLAYING',
  score: 0, distance: 0, speed: 8, hp: 3,
  skinColor: 'CYAN',
  player: {
    lane: 1, targetLane: 1, laneT: 1,
    action: 'RUNNING', queuedLane: null,
    yPos: 0, yVelocity: 0,
    slideTimer: 0, invincibleTimer: 0,
  },
  powerUp: null,
  droneProximity: 0,
}
const playerApi = initPlayer(scene, gameState.skinColor)
const obstacleApi = initObstacles(scene)

initInput(action => {
  if (gameState.status !== 'PLAYING') return
  const p = gameState.player
  switch (action) {
    case 'LEFT': {
      const next = p.lane - 1
      if (next < 0) break
      if (p.action === 'LANE_SWITCH') { p.queuedLane = next; break }
      p.targetLane = next; p.laneT = 0; p.action = 'LANE_SWITCH'
      break
    }
    case 'RIGHT': {
      const next = p.lane + 1
      if (next > 2) break
      if (p.action === 'LANE_SWITCH') { p.queuedLane = next; break }
      p.targetLane = next; p.laneT = 0; p.action = 'LANE_SWITCH'
      break
    }
    case 'JUMP':
      if (p.action !== 'JUMPING') {
        p.action = 'JUMPING'
        p.yVelocity = JUMP_VELOCITY
      }
      break
    case 'SLIDE':
      if (p.action !== 'JUMPING' && p.action !== 'SLIDING') {
        p.action = 'SLIDING'
        p.slideTimer = SLIDE_DURATION
      }
      break
  }
})

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

let last = performance.now()
renderer.setAnimationLoop(() => {
  const now = performance.now()
  const delta = Math.min((now - last) / 1000, 0.05)
  last = now
  playerApi.update(delta, gameState)
  obstacleApi.update(delta, gameState)
  updateScene(delta, gameState.speed)
  renderer.render(scene, camera)
})
