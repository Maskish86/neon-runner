import * as THREE from 'three'

function emissiveMat(color, emissive, intensity = 1.5) {
  return new THREE.MeshStandardMaterial({
    color, emissive, emissiveIntensity: intensity, roughness: 0.4, metalness: 0.5,
  })
}

// ─── HOLOGRAM_SIGN ────────────────────────────────────────────────────────────
function hologramSignA() {
  const group = new THREE.Group()
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 2.15, 0.1),
    emissiveMat(0x003366, 0x0066ff)
  )
  panel.position.y = 1.075
  panel.name = 'signPanel'
  group.add(panel)
  const frameMat = emissiveMat(0x002244, 0x00aaff, 2.5)
  ;[2.15, 0].forEach(y => {
    const e = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.05, 0.05), frameMat)
    e.position.set(0, y, 0.06)
    group.add(e)
  })
  ;[-1.2, 1.2].forEach(x => {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.2, 0.05), frameMat)
    e.position.set(x, 1.075, 0.06)
    group.add(e)
  })
  const textMat = emissiveMat(0x002233, 0x00ccff, 1.2)
  ;[1.7, 1.4, 1.1].forEach(y => {
    const line = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 0.05), textMat)
    line.position.set(0, y, 0.08)
    group.add(line)
  })
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
  const geo = new THREE.CylinderGeometry(0.15, 0.15, 2.6, 8)
  geo.rotateZ(Math.PI / 2)
  const pipe = new THREE.Mesh(geo, emissiveMat(0x004444, 0x00ffff))
  pipe.position.y = 1.2
  pipe.name = 'pipe'
  group.add(pipe)
  const capMat = emissiveMat(0x006666, 0x00ffff, 3)
  ;[-1.3, 1.3].forEach(x => {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 12), capMat)
    cap.rotation.z = Math.PI / 2
    cap.position.set(x, 1.2, 0)
    group.add(cap)
  })
  const bracketMat = emissiveMat(0x003333, 0x006666, 1)
  ;[-0.8, 0.8].forEach(x => {
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.06), bracketMat)
    bracket.position.set(x, 0.6, 0)
    group.add(bracket)
  })
  group.userData.type = 'NEON_PIPE'
  group.userData.avoidWith = 'SLIDE'
  group.userData.time = 0
  group.userData.hazardAABB = { minX: -1.3, maxX: 1.3, minY: 0.95, maxY: 1.45, minZ: -0.15, maxZ: 0.15 }
  return group
}

// ─── GAP ──────────────────────────────────────────────────────────────────────
function gapA() {
  const group = new THREE.Group()
  const geo = new THREE.PlaneGeometry(2.4, 3)
  geo.rotateX(-Math.PI / 2)
  const floor = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x000000 }))
  floor.position.y = -0.05
  group.add(floor)
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff3300, emissiveIntensity: 4 })
  const edgeH = new THREE.BoxGeometry(2.4, 0.06, 0.06)
  const edgeV = new THREE.BoxGeometry(0.06, 0.06, 3)
  ;[-1.5, 1.5].forEach((z, i) => {
    const e = new THREE.Mesh(edgeH, edgeMat)
    e.position.set(0, 0, z)
    if (i === 0) e.name = 'gapEdge'
    group.add(e)
  })
  ;[-1.2, 1.2].forEach(x => {
    const e = new THREE.Mesh(edgeV, edgeMat)
    e.position.set(x, 0, 0)
    group.add(e)
  })
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
  ;[-1.1, 1.1].forEach(x => {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 0.14), emissiveMat(0x440000, 0xff0000, 2))
    base.position.set(x, 0.15, 0)
    const mid = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.8, 0.08), emissiveMat(0x440000, 0xff0000, 2))
    mid.position.set(x, 1.05, 0)
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 0.14), emissiveMat(0x440000, 0xff0000, 2))
    top.position.set(x, 1.95, 0)
    group.add(base, mid, top)
  })
  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.08), emissiveMat(0x440000, 0xff0000, 2))
  crossbar.position.y = 2.1
  group.add(crossbar)
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
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.4), emissiveMat(0x222200, 0xffcc00, 1.5))
  body.position.y = 0.5
  body.name = 'botBody'
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.3), emissiveMat(0x333300, 0xffcc00, 2))
  head.position.y = 1.0
  head.name = 'botHead'
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x440000, emissive: 0xff2200, emissiveIntensity: 3 })
  const eyeGeo = new THREE.SphereGeometry(0.05, 6, 6)
  const lEye = new THREE.Mesh(eyeGeo, eyeMat); lEye.position.set(-0.07, 1.02, 0.16)
  const rEye = new THREE.Mesh(eyeGeo, eyeMat); rEye.position.set(0.07, 1.02, 0.16)
  const antennaShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), emissiveMat(0x222200, 0xffcc00, 2))
  antennaShaft.position.set(0, 1.4, 0)
  const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), emissiveMat(0x333300, 0xffff00, 3))
  antennaTip.position.set(0, 1.58, 0)
  group.add(body, head, lEye, rEye, antennaShaft, antennaTip)
  group.userData.type = 'PATROL_BOT'
  group.userData.avoidWith = 'LANE'
  group.userData.patrolDir = 1
  group.userData.patrolSpeed = 2.5
  group.userData.time = 0
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

function neonPipeB() { return neonPipeA() }
function neonPipeC() { return neonPipeA() }

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
function laserGateB() { return laserGateA() }
function patrolBotB() { return patrolBotA() }
function patrolBotC() { return patrolBotA() }
function wideWallA() {
  const g = hologramSignA()
  g.userData.type = 'WIDE_WALL'
  g.userData.avoidWith = 'JUMP'
  g.userData.hazardAABB = { minX: -1.45, maxX: 1.45, minY: 0, maxY: 1.9, minZ: -0.15, maxZ: 0.15 }
  return g
}
function wideWallB() {
  const g = hologramSignA()
  g.userData.type = 'WIDE_WALL'
  g.userData.avoidWith = 'JUMP'
  g.userData.hazardAABB = { minX: -1.45, maxX: 1.45, minY: 0, maxY: 1.9, minZ: -0.15, maxZ: 0.15 }
  return g
}
function wideHurdleA() {
  const g = neonPipeA()
  g.userData.type = 'WIDE_HURDLE'
  g.userData.avoidWith = 'SLIDE'
  g.userData.hazardAABB = { minX: -1.45, maxX: 1.45, minY: 0.95, maxY: 1.45, minZ: -0.15, maxZ: 0.15 }
  return g
}
function wideHurdleB() {
  const g = neonPipeA()
  g.userData.type = 'WIDE_HURDLE'
  g.userData.avoidWith = 'SLIDE'
  g.userData.hazardAABB = { minX: -1.45, maxX: 1.45, minY: 0.95, maxY: 1.45, minZ: -0.15, maxZ: 0.15 }
  return g
}
function spinnerBotA() {
  const g = patrolBotA()
  g.userData.type = 'SPINNER_BOT'
  g.userData.avoidWith = 'TIMING'
  g.userData.spinAngle = 0
  g.userData.spinSpeed = 1.5
  return g
}
function chargerBotA() {
  const g = patrolBotA()
  g.userData.type = 'CHARGER_BOT'
  g.userData.avoidWith = 'LANE'
  g.userData.chargeState = 'APPROACH'
  g.userData.windupTimer = 0
  g.userData.chargeTimer = 0
  g.userData.baseX = 0
  return g
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
  // Arm rotates on Y axis, extends along X. cosA = X span factor.
  // Safe when arm points in Z direction (toward/away from player) — small X profile.
  const cosA = Math.cos(spinAngle)
  if (Math.abs(cosA) < 0.3) {
    return { minX: -0.65, maxX: 0.65, minY: 99, maxY: 100, minZ: -0.15, maxZ: 0.15 }
  }
  return { minX: -0.65, maxX: 0.65, minY: 0.65, maxY: 1.05, minZ: -0.15, maxZ: 0.15 }
}

export function tickChargerBot(state, delta, speed, objZ) {
  const s = { ...state, time: state.time + delta }
  if (s.chargeState === 'APPROACH') {
    if (objZ > -20) s.chargeState = 'WINDUP'
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
