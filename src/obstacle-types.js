import * as THREE from 'three'

function emissiveMat(color, emissive, intensity = 1.5) {
  return new THREE.MeshStandardMaterial({
    color, emissive, emissiveIntensity: intensity, roughness: 0.4, metalness: 0.5,
  })
}

// ─── HOLOGRAM_SIGN ────────────────────────────────────────────────────────────
function hologramSignA() {
  const group = new THREE.Group()
  // Dual base mounting posts
  const postMat = emissiveMat(0x001133, 0x0044aa, 1.2)
  ;[-0.85, 0.85].forEach(x => {
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.08), postMat)
    shaft.position.set(x, 0.175, 0)
    group.add(shaft)
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.2), postMat)
    foot.position.set(x, 0.0, 0)
    group.add(foot)
  })
  // Panel
  const panel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.95, 0.08), emissiveMat(0x003366, 0x0066ff))
  panel.position.y = 1.075
  panel.name = 'signPanel'
  group.add(panel)
  // Double frame — outer
  const outerMat = emissiveMat(0x002244, 0x00aaff, 2.5)
  ;[2.08, 0.08].forEach(y => {
    const e = new THREE.Mesh(new THREE.BoxGeometry(2.48, 0.06, 0.06), outerMat)
    e.position.set(0, y, 0.1)
    group.add(e)
  })
  ;[-1.22, 1.22].forEach(x => {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.05, 0.06), outerMat)
    e.position.set(x, 1.08, 0.1)
    group.add(e)
  })
  // Inner accent strip
  const accentMat = emissiveMat(0x001144, 0x0088ff, 3.5)
  const strip = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.04, 0.04), accentMat)
  strip.position.set(0, 0.28, 0.1)
  group.add(strip)
  // Corner joints
  const jointMat = emissiveMat(0x003366, 0x0099ff, 2)
  ;[[-1.2, 2.06], [1.2, 2.06], [-1.2, 0.1], [1.2, 0.1]].forEach(([x, y]) => {
    const j = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.13), jointMat)
    j.position.set(x, y, 0.1)
    group.add(j)
  })
  // Hazard chevrons (↓ pointing down = "duck/danger ahead")
  const chevMat = emissiveMat(0x331100, 0xff6600, 3)
  ;[1.72, 1.42, 1.12].forEach((cy, ci) => {
    const alpha = 1 - ci * 0.25
    ;[[-0.55, 0], [0, -0.2], [0.55, 0]].forEach(([cx, offset]) => {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.04), chevMat)
      seg.position.set(cx, cy + offset, 0.1)
      seg.rotation.z = cx < 0 ? -0.6 : cx > 0 ? 0.6 : 0
      seg.material = emissiveMat(0x331100, 0xff6600, 3 * alpha)
      group.add(seg)
    })
  })
  // Central warning diamond
  const warnMat = emissiveMat(0x220000, 0xff2200, 4)
  const diamond = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.04), warnMat)
  diamond.rotation.z = Math.PI / 4
  diamond.position.set(0, 0.62, 0.1)
  group.add(diamond)
  // Exclamation bar inside diamond
  const exMat = emissiveMat(0x111100, 0xffff00, 5)
  const exBar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.18, 0.05), exMat)
  exBar.position.set(0, 0.65, 0.12)
  group.add(exBar)
  const exDot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.05), exMat)
  exDot.position.set(0, 0.52, 0.12)
  group.add(exDot)
  group.userData.type = 'HOLOGRAM_SIGN'
  group.userData.avoidWith = 'JUMP'
  group.userData.time = 0
  group.userData.glitchTimer = 1.2 + Math.random() * 0.8
  group.userData.hazardAABB = { minX: -0.9, maxX: 0.9, minY: 0, maxY: 1.9, minZ: -0.15, maxZ: 0.15 }
  return group
}

// ─── NEON_PIPE ────────────────────────────────────────────────────────────────
function neonPipeA() {
  const group = new THREE.Group()
  const pipeGeo = new THREE.CylinderGeometry(0.14, 0.14, 2.5, 8)
  pipeGeo.rotateZ(Math.PI / 2)
  const pipe = new THREE.Mesh(pipeGeo, emissiveMat(0x004444, 0x00ffff))
  pipe.position.y = 1.2
  pipe.name = 'pipe'
  group.add(pipe)
  // Hex-bolt flanges at ends
  const flangeMat = emissiveMat(0x006666, 0x00ffff, 3)
  ;[-1.25, 1.25].forEach(x => {
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.07, 6), flangeMat)
    flange.rotation.z = Math.PI / 2
    flange.position.set(x, 1.2, 0)
    group.add(flange)
    // Bolt dots on flange face
    ;[0, 1, 2, 3, 4, 5].forEach(i => {
      const a = (i / 6) * Math.PI * 2
      const bolt = new THREE.Mesh(new THREE.SphereGeometry(0.025, 4, 4), emissiveMat(0x003333, 0x00cccc, 2))
      bolt.position.set(x + (x > 0 ? 0.04 : -0.04), 1.2 + Math.sin(a) * 0.14, Math.cos(a) * 0.14)
      group.add(bolt)
    })
  })
  // Support brackets with warning tape
  const bracketMat = emissiveMat(0x003333, 0x006666, 1)
  ;[-0.75, 0.75].forEach(x => {
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.2, 0.07), bracketMat)
    bracket.position.set(x, 0.6, 0)
    group.add(bracket)
    // Warning tape stripes on bracket
    ;[0.2, 0.5, 0.8].forEach(t => {
      const tape = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.09), emissiveMat(0x333300, 0xffcc00, 1.5))
      tape.position.set(x, t * 1.2, 0)
      group.add(tape)
    })
  })
  // Central junction box
  const junctionMat = emissiveMat(0x003333, 0x009999, 1.5)
  const junction = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.22), junctionMat)
  junction.position.set(0, 1.2, 0)
  group.add(junction)
  // Pressure gauge on top of junction
  const gaugeMat = emissiveMat(0x333300, 0xffcc00, 2)
  const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 10), gaugeMat)
  gauge.position.set(0, 1.32, 0)
  group.add(gauge)
  group.userData.type = 'NEON_PIPE'
  group.userData.avoidWith = 'SLIDE'
  group.userData.time = 0
  group.userData.hazardAABB = { minX: -1.3, maxX: 1.3, minY: 0.95, maxY: 1.45, minZ: -0.15, maxZ: 0.15 }
  return group
}

// ─── GAP ──────────────────────────────────────────────────────────────────────
function gapA() {
  const group = new THREE.Group()
  // Dark void
  const voidGeo = new THREE.PlaneGeometry(2.4, 3)
  voidGeo.rotateX(-Math.PI / 2)
  const voidFloor = new THREE.Mesh(voidGeo, new THREE.MeshBasicMaterial({ color: 0x000000 }))
  voidFloor.position.y = -0.05
  group.add(voidFloor)
  // Grid pattern on void floor
  const gridMat = new THREE.MeshStandardMaterial({ color: 0x110000, emissive: 0x330000, emissiveIntensity: 1 })
  for (let xi = -1; xi <= 1; xi++) {
    const hLine = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.01, 0.03), gridMat)
    hLine.position.set(0, -0.04, xi * 0.6)
    group.add(hLine)
  }
  for (let zi = -2; zi <= 2; zi++) {
    const vLine = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.01, 3), gridMat)
    vLine.position.set(zi * 0.55, -0.04, 0)
    group.add(vLine)
  }
  // Warning edges
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff3300, emissiveIntensity: 4 })
  ;[-1.5, 1.5].forEach((z, i) => {
    const e = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 0.06), edgeMat)
    e.position.set(0, 0, z)
    if (i === 0) e.name = 'gapEdge'
    group.add(e)
  })
  ;[-1.2, 1.2].forEach(x => {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 3), edgeMat)
    e.position.set(x, 0, 0)
    group.add(e)
  })
  // Broken concrete chunks on edges (6 pieces)
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 })
  ;[-1.1, -0.3, 0.3, 1.1].forEach(x => {
    ;[-1.3, 1.3].forEach(z => {
      if (Math.random() > 0.5) {
        const chunk = new THREE.Mesh(
          new THREE.BoxGeometry(0.15 + Math.random() * 0.1, 0.06 + Math.random() * 0.08, 0.15 + Math.random() * 0.1),
          concreteMat
        )
        chunk.position.set(x, 0.03, z)
        chunk.rotation.y = Math.random() * Math.PI
        group.add(chunk)
      }
    })
  })
  // Depth indicator markers (vertical lines at each side)
  const depthMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2200, emissiveIntensity: 2 })
  ;[-1.2, 1.2].forEach(x => {
    const marker = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.4, 0.03), depthMat)
    marker.position.set(x, -0.2, 0)
    group.add(marker)
  })
  // Cross markers
  const crossMat = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff0000, emissiveIntensity: 2 })
  const diagGeo = new THREE.BoxGeometry(3.6, 0.04, 0.04)
  const cross1 = new THREE.Mesh(diagGeo, crossMat); cross1.position.y = 0.02; cross1.rotation.y = Math.PI / 4
  const cross2 = new THREE.Mesh(diagGeo, crossMat); cross2.position.y = 0.02; cross2.rotation.y = -Math.PI / 4
  group.add(cross1, cross2)
  group.userData.type = 'GAP'
  group.userData.avoidWith = 'JUMP'
  group.userData.time = 0
  group.userData.hazardAABB = { minX: -1.2, maxX: 1.2, minY: -10, maxY: 0.05, minZ: -1.5, maxZ: 1.5 }
  return group
}

// ─── LASER_GATE ───────────────────────────────────────────────────────────────
function laserGateA() {
  const group = new THREE.Group()
  const postMat = emissiveMat(0x440000, 0xff0000, 2)
  ;[-1.1, 1.1].forEach(x => {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.16), postMat)
    base.position.set(x, 0.15, 0)
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.8, 0.09), postMat)
    shaft.position.set(x, 1.05, 0)
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.16), postMat)
    top.position.set(x, 1.95, 0)
    group.add(base, shaft, top)
    // Heat sink fins (3 per post)
    const finMat = emissiveMat(0x330000, 0xcc0000, 1.5)
    ;[0.6, 1.0, 1.4].forEach(y => {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.18), finMat)
      fin.position.set(x, y, 0)
      group.add(fin)
    })
    // Emitter sphere at top
    const emitter = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), emissiveMat(0x440000, 0xff2200, 4))
    emitter.position.set(x, 2.14, 0)
    group.add(emitter)
  })
  // Crossbar with chevrons
  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.09, 0.09), emissiveMat(0x440000, 0xff0000, 2))
  crossbar.position.y = 2.1
  group.add(crossbar)
  // Chevron warning markers on crossbar
  const chevMat = emissiveMat(0x333300, 0xffcc00, 2)
  ;[-0.5, 0, 0.5].forEach(x => {
    const chev = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.07), chevMat)
    chev.position.set(x, 2.1, 0.06)
    group.add(chev)
  })
  // Beams
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.06), emissiveMat(0x440000, 0xff0000, 3))
  beam.position.y = 1.2
  beam.name = 'beam'
  group.add(beam)
  const beam2 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.03, 0.03), emissiveMat(0x220000, 0xff4400, 2))
  beam2.position.y = 1.1
  beam2.name = 'beam2'
  group.add(beam2)
  group.userData.type = 'LASER_GATE'
  group.userData.avoidWith = 'SLIDE'
  group.userData.blinkTimer = 0
  group.userData.active = true
  group.userData.hazardAABB = { minX: -1.1, maxX: 1.1, minY: 1.07, maxY: 1.23, minZ: -0.03, maxZ: 0.03 }
  return group
}

// ─── PATROL_BOT ───────────────────────────────────────────────────────────────
function patrolBotA() {
  const group = new THREE.Group()
  const bodyMat = emissiveMat(0x222200, 0xffcc00, 1.5)
  // Feet
  ;[-0.13, 0.13].forEach(x => {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.22), emissiveMat(0x111100, 0xaa8800, 1))
    foot.position.set(x, 0.03, 0.03)
    group.add(foot)
    // Leg
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.14), emissiveMat(0x1a1a00, 0xcc9900, 1.2))
    leg.position.set(x, 0.2, 0)
    group.add(leg)
  })
  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.38), bodyMat)
  body.position.y = 0.59
  body.name = 'botBody'
  group.add(body)
  // Chest sensor panel
  const sensorMat = emissiveMat(0x221100, 0xff6600, 2)
  const sensor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.04), sensorMat)
  sensor.position.set(0, 0.6, 0.2)
  group.add(sensor)
  // Sensor grid lines
  const gridMat = emissiveMat(0x332200, 0xffaa00, 3)
  ;[-0.05, 0.05].forEach(x => {
    const gl = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.03), gridMat)
    gl.position.set(x, 0.6, 0.22)
    group.add(gl)
  })
  // Arm stubs
  ;[-0.32, 0.32].forEach(x => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.12), emissiveMat(0x1a1a00, 0xcc9900, 1))
    arm.position.set(x, 0.62, 0)
    group.add(arm)
  })
  // Head with visor
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.26, 0.3), bodyMat)
  head.position.y = 1.02
  head.name = 'botHead'
  group.add(head)
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.07, 0.04), emissiveMat(0x440000, 0xff6600, 3))
  visor.position.set(0, 1.02, 0.17)
  group.add(visor)
  // Eyes (small, below visor)
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x440000, emissive: 0xff2200, emissiveIntensity: 3 })
  ;[-0.07, 0.07].forEach(x => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeMat)
    eye.position.set(x, 1.0, 0.16)
    group.add(eye)
  })
  // Antenna
  const antShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.32, 6), bodyMat)
  antShaft.position.set(0, 1.41, 0)
  const antTip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), emissiveMat(0x333300, 0xffff00, 3))
  antTip.position.set(0, 1.6, 0)
  group.add(antShaft, antTip)
  group.userData.type = 'PATROL_BOT'
  group.userData.avoidWith = 'LANE'
  group.userData.patrolDir = 1
  group.userData.patrolSpeed = 2.5
  group.userData.time = 0
  group.userData.bodyBaseY = 0.59
  group.userData.hazardAABB = { minX: -0.25, maxX: 0.25, minY: 0, maxY: 1.35, minZ: -0.2, maxZ: 0.2 }
  return group
}

// ─── STUBS (replaced in Tasks 2–6) ───────────────────────────────────────────
function hologramSignB() {
  const group = new THREE.Group()
  // Angled support pole
  const poleMat = emissiveMat(0x111122, 0x334466, 0.8)
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 2.3, 8), poleMat)
  pole.position.set(0.7, 1.15, 0)
  pole.rotation.z = 0.08
  group.add(pole)
  // Pole foot anchor
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.22), poleMat)
  foot.position.set(0.7, 0.03, 0)
  group.add(foot)
  // Panel
  const panel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.85, 0.08), emissiveMat(0x003366, 0x0066ff))
  panel.position.y = 1.1
  panel.name = 'signPanel'
  group.add(panel)
  // Diagonal stripe overlays
  const stripeMat = emissiveMat(0x000033, 0x002299, 0.7)
  ;[-0.4, 0.2, 0.8].forEach(offset => {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.09, 0.05), stripeMat)
    stripe.position.set(0, 0.4 + offset * 1.5, 0.07)
    stripe.rotation.z = 0.28
    group.add(stripe)
  })
  // Frame
  const frameMat = emissiveMat(0x002244, 0x00aaff, 2.5)
  ;[2.03, 0.17].forEach(y => {
    const e = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.05, 0.05), frameMat)
    e.position.set(0, y, 0.1)
    group.add(e)
  })
  // Warning beacon on top
  const beaconMat = emissiveMat(0x440000, 0xff4400, 3)
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), beaconMat)
  beacon.position.set(0, 2.15, 0)
  beacon.name = 'beacon'
  group.add(beacon)
  const beaconRing = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 12), emissiveMat(0x330000, 0xff2200, 2))
  beaconRing.position.set(0, 2.14, 0)
  group.add(beaconRing)
  group.userData.type = 'HOLOGRAM_SIGN'
  group.userData.avoidWith = 'JUMP'
  group.userData.time = 0
  group.userData.glitchTimer = 1.2 + Math.random() * 0.8
  group.userData.hazardAABB = { minX: -0.9, maxX: 0.9, minY: 0, maxY: 1.9, minZ: -0.15, maxZ: 0.15 }
  return group
}

function hologramSignC() {
  const group = new THREE.Group()
  const panelMat = emissiveMat(0x003366, 0x0066ff)
  // Upper panel, slight outward angle
  const upper = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.85, 0.08), panelMat)
  upper.position.set(0, 1.6, 0)
  upper.rotation.y = 0.06
  upper.name = 'signPanel'
  group.add(upper)
  // Lower panel, opposite angle
  const lower = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.85, 0.08), panelMat)
  lower.position.set(0, 0.55, 0)
  lower.rotation.y = -0.06
  group.add(lower)
  // Neon band between panels
  const bandMat = emissiveMat(0x001133, 0x00ffff, 3)
  const band = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.14, 0.14), bandMat)
  band.position.set(0, 1.1, 0)
  group.add(band)
  // Side connector bars
  const connMat = emissiveMat(0x002244, 0x00aaff, 2)
  ;[-1.05, 1.05].forEach(x => {
    const conn = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.0, 0.06), connMat)
    conn.position.set(x, 1.08, 0)
    group.add(conn)
  })
  // Top and bottom frame lines
  ;[2.05, 0.1].forEach(y => {
    const f = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 0.05), connMat)
    f.position.set(0, y, 0.1)
    group.add(f)
  })
  group.userData.type = 'HOLOGRAM_SIGN'
  group.userData.avoidWith = 'JUMP'
  group.userData.time = 0
  group.userData.glitchTimer = 1.2 + Math.random() * 0.8
  group.userData.hazardAABB = { minX: -0.9, maxX: 0.9, minY: 0, maxY: 1.9, minZ: -0.15, maxZ: 0.15 }
  return group
}

function neonPipeB() {
  const group = new THREE.Group()
  const configs = [
    { y: 1.05, r: 0.1, len: 2.6 },  // lowest — sets collision floor
    { y: 1.25, r: 0.08, len: 2.3 },
    { y: 1.45, r: 0.06, len: 1.8 },
  ]
  configs.forEach(({ y, r, len }, i) => {
    const geo = new THREE.CylinderGeometry(r, r, len, 8)
    geo.rotateZ(Math.PI / 2)
    const pipe = new THREE.Mesh(geo, emissiveMat(0x004444, 0x00ffff, 1.5 - i * 0.3))
    pipe.position.y = y
    if (i === 0) pipe.name = 'pipe'
    group.add(pipe)
  })
  // Bundling clamps at 3 positions
  const clampMat = emissiveMat(0x003333, 0x006666, 1)
  ;[-0.7, 0, 0.7].forEach(x => {
    const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), clampMat)
    clamp.position.set(x, 1.2, 0)
    group.add(clamp)
  })
  group.userData.type = 'NEON_PIPE'
  group.userData.avoidWith = 'SLIDE'
  group.userData.time = 0
  group.userData.hazardAABB = { minX: -1.3, maxX: 1.3, minY: 0.95, maxY: 1.45, minZ: -0.15, maxZ: 0.15 }
  return group
}

function neonPipeC() {
  const group = new THREE.Group()
  // Main pipe
  const pipeGeo = new THREE.CylinderGeometry(0.14, 0.14, 2.2, 8)
  pipeGeo.rotateZ(Math.PI / 2)
  const pipe = new THREE.Mesh(pipeGeo, emissiveMat(0x004444, 0x00ffff))
  pipe.position.y = 1.2
  pipe.name = 'pipe'
  group.add(pipe)
  // Valve wheels at each end
  const valveMat = emissiveMat(0x336666, 0x00cccc, 2)
  ;[-1.1, 1.1].forEach(x => {
    // Wheel rim
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 12), valveMat)
    rim.rotation.y = Math.PI / 2
    rim.position.set(x, 1.2, 0)
    group.add(rim)
    // Wheel spokes (3)
    ;[0, Math.PI / 3 * 2, Math.PI / 3 * 4].forEach(angle => {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.44, 0.04), valveMat)
      spoke.position.set(x, 1.2, 0)
      spoke.rotation.x = angle
      group.add(spoke)
    })
    // Flange
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 10), valveMat)
    flange.rotation.z = Math.PI / 2
    flange.position.set(x, 1.2, 0)
    group.add(flange)
  })
  // Pressure gauge (center top)
  const gaugeMat = emissiveMat(0x333300, 0xffcc00, 2)
  const gaugeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 10), gaugeMat)
  gaugeBody.position.set(0, 1.36, 0)
  const gaugeNeedle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.02), emissiveMat(0x440000, 0xff2200, 3))
  gaugeNeedle.position.set(0, 1.41, 0)
  gaugeNeedle.rotation.z = 0.4
  group.add(gaugeBody, gaugeNeedle)
  // Pipe segments — weld rings
  const weldMat = emissiveMat(0x006666, 0x00ffff, 1)
  ;[-0.55, 0, 0.55].forEach(x => {
    const weld = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 10), weldMat)
    weld.rotation.z = Math.PI / 2
    weld.position.set(x, 1.2, 0)
    group.add(weld)
  })
  group.userData.type = 'NEON_PIPE'
  group.userData.avoidWith = 'SLIDE'
  group.userData.time = 0
  group.userData.hazardAABB = { minX: -1.3, maxX: 1.3, minY: 0.95, maxY: 1.45, minZ: -0.15, maxZ: 0.15 }
  return group
}

function gapB() {
  const group = new THREE.Group()
  // Dark floor void
  const voidGeo = new THREE.PlaneGeometry(2.4, 3)
  voidGeo.rotateX(-Math.PI / 2)
  const voidFloor = new THREE.Mesh(voidGeo, new THREE.MeshBasicMaterial({ color: 0x000011 }))
  voidFloor.position.y = -0.05
  group.add(voidFloor)
  // Blue-white glow plane at bottom of chasm
  const glowGeo = new THREE.PlaneGeometry(2.2, 2.8)
  glowGeo.rotateX(-Math.PI / 2)
  const glowMat = new THREE.MeshStandardMaterial({ color: 0x001133, emissive: 0x0044ff, emissiveIntensity: 3, transparent: true, opacity: 0.6 })
  const glowFloor = new THREE.Mesh(glowGeo, glowMat)
  glowFloor.position.y = -0.04
  glowFloor.name = 'gapEdge'
  group.add(glowFloor)
  // Fog volume (semi-transparent box rising from gap)
  const fogMat = new THREE.MeshStandardMaterial({ color: 0x001133, emissive: 0x0022aa, emissiveIntensity: 0.5, transparent: true, opacity: 0.18 })
  const fog = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 2.8), fogMat)
  fog.position.y = 0.3
  group.add(fog)
  // Electric arc edges
  const arcMat = new THREE.MeshStandardMaterial({ color: 0x002255, emissive: 0x0088ff, emissiveIntensity: 4 })
  ;[-1.5, 1.5].forEach(z => {
    const arc = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.05, 0.05), arcMat)
    arc.position.set(0, 0, z)
    group.add(arc)
  })
  ;[-1.2, 1.2].forEach(x => {
    const arc = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 3), arcMat)
    arc.position.set(x, 0, 0)
    group.add(arc)
  })
  group.userData.type = 'GAP'
  group.userData.avoidWith = 'JUMP'
  group.userData.time = 0
  group.userData.hazardAABB = { minX: -1.2, maxX: 1.2, minY: -10, maxY: 0.05, minZ: -1.5, maxZ: 1.5 }
  return group
}
function laserGateB() {
  const group = new THREE.Group()
  const postMat = emissiveMat(0x440000, 0xff0000, 2)
  // Posts (same as A)
  ;[-1.1, 1.1].forEach(x => {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 0.14), postMat)
    base.position.set(x, 0.15, 0)
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.8, 0.08), postMat)
    shaft.position.set(x, 1.05, 0)
    group.add(base, shaft)
  })
  // Arch top — approximated with 5 box segments forming a curve
  const archMat = emissiveMat(0x440000, 0xff0000, 2)
  const archSegs = 5
  for (let i = 0; i < archSegs; i++) {
    const t = i / (archSegs - 1)   // 0 → 1
    const angle = Math.PI + t * Math.PI  // π → 2π (bottom half of circle = arch)
    const r = 1.2
    const cx = Math.cos(angle) * r   // -1.2 → 1.2
    const cy = Math.sin(angle) * r + 2.1  // 0 at ends, +r at top
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), archMat)
    seg.position.set(cx, cy, 0)
    seg.rotation.z = angle + Math.PI / 2
    group.add(seg)
  }
  // Beam (same height as A)
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.06), emissiveMat(0x440000, 0xff0000, 3))
  beam.position.y = 1.2
  beam.name = 'beam'
  group.add(beam)
  const beam2 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.03, 0.03), emissiveMat(0x220000, 0xff4400, 2))
  beam2.position.y = 1.1
  beam2.name = 'beam2'
  group.add(beam2)
  group.userData.type = 'LASER_GATE'
  group.userData.avoidWith = 'SLIDE'
  group.userData.blinkTimer = 0
  group.userData.active = true
  group.userData.hazardAABB = { minX: -1.1, maxX: 1.1, minY: 1.07, maxY: 1.23, minZ: -0.03, maxZ: 0.03 }
  return group
}
function patrolBotB() {
  const group = new THREE.Group()
  const bodyMat = emissiveMat(0x003300, 0x00ff44, 1.5)
  // Legs
  ;[-0.1, 0.1].forEach(x => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.12), emissiveMat(0x002200, 0x00cc33, 1))
    leg.position.set(x, 0.15, 0)
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.18), emissiveMat(0x002200, 0x00cc33, 1))
    foot.position.set(x, 0.0, 0.03)
    group.add(leg, foot)
  })
  // Slim torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 0.25), bodyMat)
  torso.position.y = 0.65
  torso.name = 'botBody'
  group.add(torso)
  // Shoulder armor plates
  ;[-0.22, 0.22].forEach(x => {
    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.15), emissiveMat(0x002200, 0x00ff44, 2))
    shoulder.position.set(x, 0.8, 0)
    group.add(shoulder)
  })
  // Tall head with single large eye
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.24), bodyMat)
  head.position.y = 1.15
  head.name = 'botHead'
  group.add(head)
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x001100, emissive: 0x00ff88, emissiveIntensity: 4 })
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.04), eyeMat)
  eye.position.set(0, 1.16, 0.14)
  group.add(eye)
  // Antenna
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.35, 6), bodyMat)
  ant.position.set(0, 1.48, 0)
  const antTip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), emissiveMat(0x003300, 0x00ffaa, 4))
  antTip.position.set(0, 1.68, 0)
  group.add(ant, antTip)
  group.userData.type = 'PATROL_BOT'
  group.userData.avoidWith = 'LANE'
  group.userData.patrolDir = 1
  group.userData.patrolSpeed = 2.5
  group.userData.time = 0
  group.userData.bodyBaseY = 0.65
  group.userData.hazardAABB = { minX: -0.25, maxX: 0.25, minY: 0, maxY: 1.35, minZ: -0.2, maxZ: 0.2 }
  return group
}
function patrolBotC() {
  const group = new THREE.Group()
  const bodyMat = emissiveMat(0x331100, 0xff6600, 1.5)
  // Short thick legs
  ;[-0.18, 0.18].forEach(x => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.25, 0.2), emissiveMat(0x221100, 0xff4400, 1))
    leg.position.set(x, 0.125, 0)
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.25), emissiveMat(0x221100, 0xff4400, 1))
    foot.position.set(x, 0.0, 0.02)
    group.add(leg, foot)
  })
  // Wide low body
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.45), bodyMat)
  torso.position.y = 0.55
  torso.name = 'botBody'
  group.add(torso)
  // Chest vents
  const ventMat = emissiveMat(0x220800, 0xff3300, 2)
  ;[-0.15, 0, 0.15].forEach(x => {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.04), ventMat)
    vent.position.set(x, 0.52, 0.24)
    group.add(vent)
  })
  // Short wide head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.22, 0.35), bodyMat)
  head.position.y = 0.94
  head.name = 'botHead'
  group.add(head)
  // Visor strip
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.07, 0.04), emissiveMat(0x220000, 0xff8800, 3))
  visor.position.set(0, 0.95, 0.19)
  group.add(visor)
  // Shoulder spotlights
  ;[-0.42, 0.42].forEach(x => {
    const mount = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), emissiveMat(0x221100, 0xff4400, 1))
    mount.position.set(x, 0.72, 0)
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.1, 8), emissiveMat(0x332200, 0xffcc00, 3))
    lens.rotation.z = Math.PI / 2
    lens.position.set(x > 0 ? x + 0.08 : x - 0.08, 0.72, 0.12)
    group.add(mount, lens)
  })
  group.userData.type = 'PATROL_BOT'
  group.userData.avoidWith = 'LANE'
  group.userData.patrolDir = 1
  group.userData.patrolSpeed = 2.5
  group.userData.time = 0
  group.userData.bodyBaseY = 0.55
  group.userData.hazardAABB = { minX: -0.25, maxX: 0.25, minY: 0, maxY: 1.35, minZ: -0.2, maxZ: 0.2 }
  return group
}
function wideWallA() {
  const group = new THREE.Group()
  const doorMat = emissiveMat(0x111111, 0x333333, 0.4)
  // Main door panel
  const door = new THREE.Mesh(new THREE.BoxGeometry(5.5, 2.0, 0.14), doorMat)
  door.position.y = 1.0
  group.add(door)
  // Warning stripes (diagonal yellow-black pattern via horizontal alternating bands)
  const warnYellow = emissiveMat(0x333300, 0xffcc00, 1.5)
  const warnBlack = emissiveMat(0x080808, 0x111100, 0.3)
  for (let i = 0; i < 8; i++) {
    const mat = i % 2 === 0 ? warnYellow : warnBlack
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.22, 0.05), mat)
    stripe.position.set(0, 0.15 + i * 0.23, 0.1)
    group.add(stripe)
  }
  // Central warning light cluster
  const warnLightMat = emissiveMat(0x440000, 0xff2200, 4)
  ;[-0.3, 0, 0.3].forEach(x => {
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), warnLightMat)
    light.position.set(x, 1.0, 0.12)
    group.add(light)
  })
  // Frame
  const frameMat = emissiveMat(0x222222, 0x666666, 1)
  ;[-2.75, 2.75].forEach(x => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.1, 0.18), frameMat)
    post.position.set(x, 1.05, 0)
    group.add(post)
  })
  ;[0.0, 2.05].forEach(y => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.1, 0.18), frameMat)
    bar.position.set(0, y, 0)
    group.add(bar)
  })
  // Searchlight on top
  const searchMat = emissiveMat(0x333300, 0xffee88, 3)
  const searchBody = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.2, 8), searchMat)
  searchBody.position.set(0, 2.2, 0)
  group.add(searchBody)
  group.userData.type = 'WIDE_WALL'
  group.userData.avoidWith = 'JUMP'
  group.userData.time = 0
  group.userData.hazardAABB = { minX: -1.45, maxX: 1.45, minY: 0, maxY: 1.9, minZ: -0.15, maxZ: 0.15 }
  return group
}
function wideWallB() {
  const group = new THREE.Group()
  // Generator posts at each end
  const postMat = emissiveMat(0x001133, 0x0044ff, 2)
  ;[-2.75, 2.75].forEach(x => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.1, 0.18), postMat)
    post.position.set(x, 1.05, 0)
    group.add(post)
    // Generator coil rings
    ;[0.5, 1.0, 1.5].forEach(y => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.03, 6, 10), emissiveMat(0x002266, 0x0088ff, 3))
      ring.position.set(x, y, 0)
      group.add(ring)
    })
  })
  // Force field — semi-transparent plane
  const fieldMat = new THREE.MeshStandardMaterial({
    color: 0x001133, emissive: 0x0055ff, emissiveIntensity: 1.5,
    transparent: true, opacity: 0.35, side: THREE.DoubleSide,
  })
  const field = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 2.0), fieldMat)
  field.position.y = 1.0
  group.add(field)
  // Electric current lines (horizontal strips)
  const currentMat = emissiveMat(0x001155, 0x44aaff, 3)
  ;[0.4, 0.9, 1.4, 1.8].forEach(y => {
    const line = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.03, 0.03), currentMat)
    line.position.set(0, y, 0.02)
    group.add(line)
  })
  group.userData.type = 'WIDE_WALL'
  group.userData.avoidWith = 'JUMP'
  group.userData.time = 0
  group.userData.hazardAABB = { minX: -1.45, maxX: 1.45, minY: 0, maxY: 1.9, minZ: -0.15, maxZ: 0.15 }
  return group
}
function wideHurdleA() {
  const group = new THREE.Group()
  const postMat = emissiveMat(0x222222, 0x555555, 0.8)
  // Support posts at each end
  ;[-2.75, 2.75].forEach(x => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.3, 0.12), postMat)
    post.position.set(x, 0.65, 0)
    group.add(post)
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.22), postMat)
    base.position.set(x, 0.0, 0)
    group.add(base)
  })
  // Horizontal scan beam arm
  const armMat = emissiveMat(0x003311, 0x00ff66, 2)
  const arm = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.07, 0.07), armMat)
  arm.position.y = 1.2
  arm.name = 'pipe'  // reuse 'pipe' name for emissive pulse update
  group.add(arm)
  // Emitter nodes at arm ends
  const emitterMat = emissiveMat(0x002211, 0x00ff88, 3)
  ;[-2.75, 2.75].forEach(x => {
    const emitter = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.14), emitterMat)
    emitter.position.set(x, 1.2, 0)
    group.add(emitter)
  })
  // Sweep indicator line (visual only — slightly above arm)
  const sweepMat = new THREE.MeshStandardMaterial({ color: 0x001100, emissive: 0x00ff44, emissiveIntensity: 1, transparent: true, opacity: 0.4 })
  const sweep = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.18, 0.04), sweepMat)
  sweep.position.y = 1.22
  group.add(sweep)
  group.userData.type = 'WIDE_HURDLE'
  group.userData.avoidWith = 'SLIDE'
  group.userData.time = 0
  group.userData.hazardAABB = { minX: -1.45, maxX: 1.45, minY: 0.95, maxY: 1.45, minZ: -0.15, maxZ: 0.15 }
  return group
}
function wideHurdleB() {
  const group = new THREE.Group()
  const houseMat = emissiveMat(0x111111, 0x444444, 0.5)
  // Low-profile housing strip (flush to ground)
  const housing = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.12, 0.3), houseMat)
  housing.position.y = 0.06
  group.add(housing)
  // Vent grilles on housing top
  const ventMat = emissiveMat(0x220000, 0x660000, 0.8)
  for (let i = -10; i <= 10; i++) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.25), ventMat)
    vent.position.set(i * 0.26, 0.12, 0)
    group.add(vent)
  }
  // Scan line at 1.1 height
  const scanMat = emissiveMat(0x330000, 0xff2200, 3)
  const scan = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.06, 0.06), scanMat)
  scan.position.y = 1.1
  scan.name = 'pipe'  // reuse for pulse update
  group.add(scan)
  // Side indicator lights
  ;[-2.75, 2.75].forEach(x => {
    const ind = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), emissiveMat(0x330000, 0xff0000, 4))
    ind.position.set(x, 0.09, 0.16)
    group.add(ind)
  })
  group.userData.type = 'WIDE_HURDLE'
  group.userData.avoidWith = 'SLIDE'
  group.userData.time = 0
  group.userData.hazardAABB = { minX: -1.45, maxX: 1.45, minY: 0.95, maxY: 1.45, minZ: -0.15, maxZ: 0.15 }
  return group
}
function spinnerBotA() {
  const group = new THREE.Group()
  const bodyMat = emissiveMat(0x220033, 0xaa00ff, 1.5)
  // Legs
  ;[-0.1, 0.1].forEach(x => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, 0.12), emissiveMat(0x110022, 0x7700cc, 1))
    leg.position.set(x, 0.14, 0)
    group.add(leg)
  })
  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.3), bodyMat)
  body.position.y = 0.52
  group.add(body)
  // Chest warning strobe
  const strobeMat = emissiveMat(0x330000, 0xff2200, 3)
  const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), strobeMat)
  strobe.position.set(0, 0.6, 0.16)
  strobe.name = 'strobe'
  group.add(strobe)
  // Arm group — rotates around Z axis (vertical wheel), mounted at shoulder level
  const armGroup = new THREE.Group()
  armGroup.position.y = 0.65
  armGroup.name = 'spinArm'
  // Central hub at pivot joint
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.12, 8), emissiveMat(0x110022, 0xcc00ff, 3))
  hub.rotation.x = Math.PI / 2
  armGroup.add(hub)
  // Two arm segments (opposite directions) — long enough to reach adjacent lanes
  ;[-1, 1].forEach(dir => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.09, 0.09), emissiveMat(0x220033, 0xaa00ff, 2))
    arm.position.set(dir * 1.25, 0, 0)
    armGroup.add(arm)
    // Glowing tip
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), emissiveMat(0x330044, 0xff00ff, 4))
    tip.position.set(dir * 2.5, 0, 0)
    armGroup.add(tip)
  })
  group.add(armGroup)
  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.22), bodyMat)
  head.position.y = 0.85
  group.add(head)
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x220033, emissive: 0xdd00ff, emissiveIntensity: 4 })
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.04), eyeMat)
  eye.position.set(0, 0.87, 0.12)
  group.add(eye)
  group.userData.type = 'SPINNER_BOT'
  group.userData.avoidWith = 'TIMING'
  group.userData.spinAngle = 0
  group.userData.spinSpeed = 1.5
  group.userData.time = 0
  group.userData.hazardAABB = calcSpinnerAABB(0)
  return group
}
function chargerBotA() {
  const group = new THREE.Group()
  const bodyMat = emissiveMat(0x002233, 0x00ccff, 1.5)
  // Forward-leaning base legs (tilted forward)
  ;[-0.15, 0.15].forEach(x => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.32, 0.18), emissiveMat(0x001122, 0x0099cc, 1))
    leg.position.set(x, 0.16, -0.06)
    leg.rotation.x = -0.2
    group.add(leg)
  })
  // Wide body, forward-swept
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.55, 0.42), bodyMat)
  torso.position.set(0, 0.6, -0.05)
  torso.rotation.x = -0.12
  torso.name = 'chargerBody'
  group.add(torso)
  // Booster nozzles on chest (facing forward = -Z direction)
  const nozzleMat = emissiveMat(0x002244, 0x0066ff, 2)
  ;[-0.14, 0, 0.14].forEach(x => {
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.14, 8), nozzleMat)
    nozzle.rotation.x = Math.PI / 2
    nozzle.position.set(x, 0.58, -0.26)
    group.add(nozzle)
    // Nozzle glow
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 8), emissiveMat(0x001133, 0x00eeff, 4))
    glow.rotation.x = Math.PI / 2
    glow.position.set(x, 0.58, -0.32)
    group.add(glow)
  })
  // Forward-swept shoulder guards
  ;[-0.38, 0.38].forEach(x => {
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.35), emissiveMat(0x001133, 0x0088ff, 1.5))
    guard.position.set(x, 0.72, -0.1)
    guard.rotation.x = -0.2
    group.add(guard)
  })
  // Head (low, armored)
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.3), bodyMat)
  head.position.set(0, 0.94, -0.04)
  group.add(head)
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.04), emissiveMat(0x001133, 0x00ffff, 4))
  visor.position.set(0, 0.94, 0.12)
  group.add(visor)
  group.userData.type = 'CHARGER_BOT'
  group.userData.avoidWith = 'LANE'
  group.userData.chargeState = 'APPROACH'
  group.userData.windupTimer = 0
  group.userData.chargeTimer = 0
  group.userData.time = 0
  group.userData.baseX = 0
  group.userData.hazardAABB = { minX: -0.25, maxX: 0.25, minY: 0, maxY: 1.1, minZ: -0.2, maxZ: 0.2 }
  return group
}

export const OBSTACLE_VARIANTS = {
  HOLOGRAM_SIGN: [hologramSignA, hologramSignB, hologramSignC],
  NEON_PIPE:     [neonPipeA, neonPipeB, neonPipeC],
  GAP:           [gapA, gapB],
  LASER_GATE:    [laserGateA, laserGateB],
  PATROL_BOT:    [patrolBotA, patrolBotB, patrolBotC],
  WIDE_WALL:     [wideWallA, wideWallB],
  WIDE_HURDLE:   [wideHurdleA, wideHurdleB],
  SPINNER_BOT:   [spinnerBotA],
  CHARGER_BOT:   [chargerBotA],
}

export function calcSpinnerAABB(spinAngle) {
  // Arm rotates on Z axis (vertical wheel, pivot at y=1.0).
  // cosA = X span factor. sinA = Y displacement from pivot.
  // Safe when arm points up or down (cosA near 0) — player can SLIDE (arm high) or JUMP (arm low).
  const cosA = Math.cos(spinAngle)
  const sinA = Math.sin(spinAngle)
  const ARM_HALF = 2.5
  const CENTER_Y = 0.65
  if (Math.abs(cosA) < 0.3) {
    return { minX: -ARM_HALF, maxX: ARM_HALF, minY: 99, maxY: 100, minZ: -0.15, maxZ: 0.15 }
  }
  return {
    minX: -ARM_HALF * Math.abs(cosA),
    maxX: ARM_HALF * Math.abs(cosA),
    minY: Math.max(0, CENTER_Y - ARM_HALF * Math.abs(sinA) - 0.05),
    maxY: CENTER_Y + ARM_HALF * Math.abs(sinA) + 0.05,
    minZ: -0.15, maxZ: 0.15,
  }
}

export function tickChargerBot(state, delta, speed, objZ) {
  const s = { ...state, time: state.time + delta }
  if (s.chargeState === 'APPROACH') {
    if (objZ > -35) { s.chargeState = 'WINDUP'; return { newState: s, dz: 0, vibX: 0 } }
    return { newState: s, dz: speed * delta, vibX: 0 }
  }
  if (s.chargeState === 'WINDUP') {
    s.windupTimer += delta
    const vibX = Math.sin(s.time * 30) * 0.03
    if (s.windupTimer >= 0.5) { s.chargeState = 'CHARGE'; s.chargeTimer = 0 }
    return { newState: s, dz: 0, vibX }
  }
  if (s.chargeState === 'CHARGE') {
    s.chargeTimer += delta
    return { newState: s, dz: speed * 5 * delta, vibX: 0 }
  }
  return { newState: s, dz: speed * delta, vibX: 0 }
}
