import * as THREE from 'three'

const TILE_LENGTH = 40
const TILE_COUNT = 3

function makeGroundMaterial() {
  // Procedural grid texture via canvas
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#0a0018'
  ctx.fillRect(0, 0, size, size)
  // Grid lines
  ctx.strokeStyle = '#0044aa'
  ctx.lineWidth = 1
  const step = size / 8
  for (let i = 0; i <= 8; i++) {
    ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, size); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, i * step); ctx.lineTo(size, i * step); ctx.stroke()
  }
  // Speed stripes (thin center verticals)
  ctx.strokeStyle = '#001133'
  ctx.lineWidth = 8
  ;[size * 0.45, size * 0.55].forEach(x => {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke()
  })
  // Lane dividers
  ctx.strokeStyle = '#00aaaa'
  ctx.lineWidth = 3
  ;[size * (3 / 8), size * (5 / 8)].forEach(x => {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke()
  })
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1, TILE_COUNT)
  return new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.15,
    metalness: 0.5,
    envMapIntensity: 1.0,
  })
}

function makeBuildings(scene) {
  const count = 60
  const geo = new THREE.BoxGeometry(1, 1, 1)
  const mat = new THREE.MeshStandardMaterial({
    color: 0x110022,
    emissive: 0x220033,
    emissiveIntensity: 0.5,
  })
  const mesh = new THREE.InstancedMesh(geo, mat, count)
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

  const dummy = new THREE.Object3D()
  const spread = 30
  for (let i = 0; i < count; i++) {
    const side = Math.random() > 0.5 ? 1 : -1
    dummy.position.set(
      side * (8 + Math.random() * spread),
      Math.random() * 10 + 2,
      -Math.random() * 200
    )
    dummy.scale.set(
      2 + Math.random() * 4,
      4 + Math.random() * 20,
      2 + Math.random() * 4,
    )
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
  }
  mesh.instanceMatrix.needsUpdate = true
  return mesh
}

function makeSkyline() {
  const geo = new THREE.PlaneGeometry(400, 80)
  const canvas = document.createElement('canvas')
  canvas.width = 1024; canvas.height = 256
  const ctx = canvas.getContext('2d')
  const grad = ctx.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, '#0a0020')
  grad.addColorStop(0.4, '#220044')
  grad.addColorStop(0.7, '#440066')
  grad.addColorStop(1, '#000010')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 1024, 256)
  // Neon city silhouette
  ctx.fillStyle = '#110022'
  for (let x = 0; x < 1024; x += 20 + Math.floor(Math.random() * 30)) {
    const h = 30 + Math.random() * 180
    ctx.fillRect(x, 256 - h, 15 + Math.random() * 25, h)
  }
  // Random neon windows
  ctx.fillStyle = '#00ffff44'
  for (let i = 0; i < 200; i++) {
    ctx.fillRect(Math.random() * 1024, Math.random() * 200 + 30, 3, 5)
  }
  const tex = new THREE.CanvasTexture(canvas)
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9, depthWrite: false })
  const plane = new THREE.Mesh(geo, mat)
  plane.position.set(0, 20, -120)
  return plane
}

export function initScene(scene) {
  // Lights
  const dirLight = new THREE.DirectionalLight(0x9944ff, 2)
  dirLight.position.set(5, 10, 5)
  dirLight.castShadow = true
  dirLight.shadow.mapSize.width = 1024
  dirLight.shadow.mapSize.height = 1024
  dirLight.shadow.camera.near = 0.5
  dirLight.shadow.camera.far = 50
  dirLight.shadow.camera.left = -10
  dirLight.shadow.camera.right = 10
  dirLight.shadow.camera.top = 10
  dirLight.shadow.camera.bottom = -10
  scene.add(dirLight)
  const pointLeft = new THREE.PointLight(0x00ffff, 3, 30)
  pointLeft.position.set(-8, 3, 0)
  scene.add(pointLeft)
  const pointRight = new THREE.PointLight(0xff00ff, 3, 30)
  pointRight.position.set(8, 3, 0)
  scene.add(pointRight)

  // Ground tiles
  const groundGroup = new THREE.Group()
  const groundGeo = new THREE.PlaneGeometry(12, TILE_LENGTH)
  groundGeo.rotateX(-Math.PI / 2)
  const groundMat = makeGroundMaterial()
  for (let i = 0; i < TILE_COUNT; i++) {
    const tile = new THREE.Mesh(groundGeo, groundMat)
    tile.position.z = -i * TILE_LENGTH
    tile.receiveShadow = true
    groundGroup.add(tile)
  }
  scene.add(groundGroup)

  // Buildings
  const buildingMesh = makeBuildings(scene)
  scene.add(buildingMesh)

  // Skyline
  scene.add(makeSkyline())

  let totalDist = 0

  function updateScene(delta, speed, cameraZ = 0) {
    pointLeft.position.z = cameraZ
    pointRight.position.z = cameraZ
    totalDist += speed * delta
    // Scroll ground tiles
    groundGroup.children.forEach(tile => {
      tile.position.z += speed * delta
      if (tile.position.z > TILE_LENGTH) {
        tile.position.z -= TILE_LENGTH * TILE_COUNT
      }
    })
    // Parallax buildings (30% speed)
    const dummy = new THREE.Object3D()
    for (let i = 0; i < buildingMesh.count; i++) {
      buildingMesh.getMatrixAt(i, dummy.matrix)
      dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale)
      dummy.position.z += speed * delta * 0.3
      if (dummy.position.z > 20) dummy.position.z -= 220
      dummy.updateMatrix()
      buildingMesh.setMatrixAt(i, dummy.matrix)
    }
    buildingMesh.instanceMatrix.needsUpdate = true
  }

  return { groundGroup, buildingMesh, updateScene }
}
