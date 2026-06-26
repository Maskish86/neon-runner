import { describe, it, expect } from 'vitest'
import { pickBeamInterval, beamHitsPlayer } from '../src/drone.js'

describe('pickBeamInterval', () => {
  it('returns 10–15 when distance < 1000', () => {
    for (let i = 0; i < 30; i++) {
      const v = pickBeamInterval(500)
      expect(v).toBeGreaterThanOrEqual(10)
      expect(v).toBeLessThanOrEqual(15)
    }
  })

  it('returns 7–12 when distance is 1000–3000', () => {
    for (let i = 0; i < 30; i++) {
      const v = pickBeamInterval(2000)
      expect(v).toBeGreaterThanOrEqual(7)
      expect(v).toBeLessThanOrEqual(12)
    }
  })

  it('returns 5–9 when distance >= 3000', () => {
    for (let i = 0; i < 30; i++) {
      const v = pickBeamInterval(5000)
      expect(v).toBeGreaterThanOrEqual(5)
      expect(v).toBeLessThanOrEqual(9)
    }
  })
})

describe('beamHitsPlayer', () => {
  it('LOW beam hits player standing on ground', () => {
    expect(beamHitsPlayer('LOW', 0, 'RUNNING')).toBe(true)
  })

  it('LOW beam hits player sliding', () => {
    expect(beamHitsPlayer('LOW', 0, 'SLIDING')).toBe(true)
  })

  it('LOW beam misses player who has jumped above beam height', () => {
    expect(beamHitsPlayer('LOW', 0.6, 'JUMPING')).toBe(false)
  })

  it('HIGH beam hits standing player', () => {
    expect(beamHitsPlayer('HIGH', 0, 'RUNNING')).toBe(true)
  })

  it('HIGH beam hits jumping player (feet below beam)', () => {
    expect(beamHitsPlayer('HIGH', 0, 'JUMPING')).toBe(true)
  })

  it('HIGH beam misses sliding player', () => {
    expect(beamHitsPlayer('HIGH', 0, 'SLIDING')).toBe(false)
  })
})
