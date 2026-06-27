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
  const geo = new THREE.BoxGeometry(1, 1, 1)
  const spread = 30

  function makeSet(count, color, emissive, emissiveIntensity) {
    const mat = new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity })
    const mesh = new THREE.InstancedMesh(geo, mat, count)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    return mesh
  }

  const dark     = makeSet(36, 0x110022, 0x220033, 0.5)
  dark.castShadow = true
  const bright   = makeSet(12, 0x1a0033, 0x330055, 0.8)
  bright.castShadow = true
  const windowed = makeSet(12, 0x110022, 0x220033, 0.5)
  windowed.castShadow = true

  // Window strips: thin emissive panels on building fronts
  const winColors = [0x00ffff, 0xff00ff, 0xffaa00]
  const winGeo = new THREE.BoxGeometry(1, 1, 0.05)
  const winMeshes = winColors.map(c =>
    new THREE.InstancedMesh(
      winGeo,
      new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2 }),
      7  // 7 strips per color = 21 total
    )
  )
  winMeshes.forEach(m => { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage) })

  const dummy = new THREE.Object3D()
  const allSets = [
    { mesh: dark,     count: 36 },
    { mesh: bright,   count: 12 },
    { mesh: windowed, count: 12 },
  ]

  let globalIdx = 0
  allSets.forEach(({ mesh, count }) => {
    for (let i = 0; i < count; i++) {
      const side = globalIdx % 2 === 0 ? 1 : -1
      const w = 2 + Math.random() * 4
      const h = 4 + Math.random() * 20
      const d = 2 + Math.random() * 4
      dummy.position.set(
        side * (8 + Math.random() * spread),
        h / 2 + 0.5,
        -Math.random() * 200
      )
      dummy.scale.set(w, h, d)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      globalIdx++
    }
    mesh.instanceMatrix.needsUpdate = true
    scene.add(mesh)
  })

  // Place window strips on "windowed" buildings
  const windowedPositions = []
  for (let i = 0; i < 12; i++) {
    windowed.getMatrixAt(i, dummy.matrix)
    dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale)
    windowedPositions.push({
      x: dummy.position.x,
      y: dummy.position.y,
      z: dummy.position.z,
      h: dummy.scale.y,
      w: dummy.scale.x,
    })
  }

  winMeshes.forEach((wm, ci) => {
    for (let i = 0; i < 7; i++) {
      const bld = windowedPositions[(ci * 7 + i) % windowedPositions.length]
      dummy.position.set(
        bld.x + (bld.x > 0 ? -bld.w * 0.5 - 0.03 : bld.w * 0.5 + 0.03),
        bld.y + (Math.random() - 0.5) * bld.h * 0.6,
        bld.z
      )
      dummy.scale.set(0.3, bld.h * 0.7, 1)
      dummy.updateMatrix()
      wm.setMatrixAt(i, dummy.matrix)
    }
    wm.instanceMatrix.needsUpdate = true
    scene.add(wm)
  })

  return { dark, bright, windowed, windows: winMeshes }
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

function makeRails() {
  const group = new THREE.Group()
  const railGeo = new THREE.BoxGeometry(0.06, 0.12, TILE_LENGTH)
  const leftMat = new THREE.MeshStandardMaterial({
    color: 0x004444, emissive: 0x00ffff, emissiveIntensity: 3,
  })
  const rightMat = new THREE.MeshStandardMaterial({
    color: 0x440044, emissive: 0xff00ff, emissiveIntensity: 3,
  })
  for (let i = 0; i < TILE_COUNT; i++) {
    const zPos = -i * TILE_LENGTH
    const left = new THREE.Mesh(railGeo, leftMat)
    left.castShadow = true
    left.position.set(-6.2, 0.06, zPos)
    group.add(left)
    const right = new THREE.Mesh(railGeo, rightMat)
    right.castShadow = true
    right.position.set(6.2, 0.06, zPos)
    group.add(right)
  }
  return group
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

  const railGroup = makeRails()
  scene.add(railGroup)

  // Buildings
  const { dark, bright, windowed, windows } = makeBuildings(scene)
  const buildingMeshes = [dark, bright, windowed, ...windows]

  // Skyline
  scene.add(makeSkyline())

  let totalDist = 0
  const dummy = new THREE.Object3D()

  function updateScene(delta, speed, cameraZ = 0) {
    pointLeft.position.z = cameraZ - 10
    pointRight.position.z = cameraZ - 10
    totalDist += speed * delta
    // Scroll ground tiles
    groundGroup.children.forEach(tile => {
      tile.position.z += speed * delta
      if (tile.position.z > TILE_LENGTH) {
        tile.position.z -= TILE_LENGTH * TILE_COUNT
      }
    })
    // Scroll rails (same cadence as ground tiles)
    railGroup.children.forEach(rail => {
      rail.position.z += speed * delta
      if (rail.position.z > TILE_LENGTH) {
        rail.position.z -= TILE_LENGTH * TILE_COUNT
      }
    })

    // Parallax buildings (30% speed)
    buildingMeshes.forEach(mesh => {
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, dummy.matrix)
        dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale)
        dummy.position.z += speed * delta * 0.3
        if (dummy.position.z > 20) dummy.position.z -= 220
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    })
  }

  return { groundGroup, buildingMeshes, updateScene }
}
