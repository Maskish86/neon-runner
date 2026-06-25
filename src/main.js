import * as THREE from 'three'
import { initScene } from './scene.js'

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
  updateScene(delta, 8)
  renderer.render(scene, camera)
})
