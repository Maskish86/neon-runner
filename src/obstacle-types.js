import * as THREE from 'three'

function emissiveMat(color, emissive, intensity = 1.5) {
  return new THREE.MeshStandardMaterial({
    color, emissive, emissiveIntensity: intensity, roughness: 0.4, metalness: 0.5,
  })
}

// Each factory returns { group: THREE.Group, type, avoidWith: 'JUMP'|'SLIDE'|'LANE'|'TIMING' }
export const OBSTACLE_FACTORIES = {
  HOLOGRAM_SIGN() {
    const group = new THREE.Group()
    const geo = new THREE.BoxGeometry(2.4, 1.5, 0.1)
    const mesh = new THREE.Mesh(geo, emissiveMat(0x003366, 0x0066ff))
    mesh.position.y = 1.4
    group.add(mesh)
    group.userData.type = 'HOLOGRAM_SIGN'
    group.userData.avoidWith = 'JUMP'
    group.userData.hazardAABB = { minX: -1.2, maxX: 1.2, minY: 0.65, maxY: 2.15, minZ: -0.05, maxZ: 0.05 }
    return group
  },

  NEON_PIPE() {
    const group = new THREE.Group()
    const geo = new THREE.CylinderGeometry(0.15, 0.15, 2.6, 8)
    geo.rotateZ(Math.PI / 2)
    const mesh = new THREE.Mesh(geo, emissiveMat(0x004444, 0x00ffff))
    mesh.position.y = 0.7  // low — player must slide
    group.add(mesh)
    group.userData.type = 'NEON_PIPE'
    group.userData.avoidWith = 'SLIDE'
    group.userData.hazardAABB = { minX: -1.3, maxX: 1.3, minY: 0.55, maxY: 0.85, minZ: -0.15, maxZ: 0.15 }
    return group
  },

  GAP() {
    // Represented as a dark void plane — collision handled logically (player must jump)
    const group = new THREE.Group()
    const geo = new THREE.PlaneGeometry(2.4, 3)
    geo.rotateX(-Math.PI / 2)
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x000000 }))
    mesh.position.y = -0.05
    group.add(mesh)
    group.userData.type = 'GAP'
    group.userData.avoidWith = 'JUMP'
    group.userData.hazardAABB = { minX: -1.2, maxX: 1.2, minY: -10, maxY: 0.05, minZ: -1.5, maxZ: 1.5 }
    return group
  },

  LASER_GATE() {
    const group = new THREE.Group()
    // Two vertical posts
    ;[-1.1, 1.1].forEach(x => {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 2.5, 0.1),
        emissiveMat(0x440000, 0xff0000, 2)
      )
      post.position.set(x, 1.25, 0)
      group.add(post)
    })
    // Laser beam (top half — must slide under)
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.06, 0.06),
      emissiveMat(0x440000, 0xff0000, 3)
    )
    beam.position.y = 1.2
    beam.name = 'beam'
    group.add(beam)
    group.userData.type = 'LASER_GATE'
    group.userData.avoidWith = 'SLIDE'  // beam at y=1.2 blocks running height; slide under
    group.userData.blinkTimer = 0
    group.userData.active = true
    group.userData.hazardAABB = { minX: -1.1, maxX: 1.1, minY: 1.17, maxY: 1.23, minZ: -0.03, maxZ: 0.03 }
    return group
  },

  PATROL_BOT() {
    const group = new THREE.Group()
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.4), emissiveMat(0x222200, 0xffcc00, 1.5))
    body.position.y = 0.5
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.3), emissiveMat(0x333300, 0xffcc00, 2))
    head.position.y = 1.0
    group.add(body, head)
    group.userData.type = 'PATROL_BOT'
    group.userData.avoidWith = 'LANE'
    group.userData.patrolDir = 1
    group.userData.patrolSpeed = 2.5
    group.userData.hazardAABB = { minX: -0.25, maxX: 0.25, minY: 0, maxY: 1.1, minZ: -0.2, maxZ: 0.2 }
    return group
  },
}

export const OBSTACLE_TYPES = Object.keys(OBSTACLE_FACTORIES)
