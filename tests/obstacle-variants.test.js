import { describe, it, expect } from 'vitest'
import { OBSTACLE_VARIANTS, calcSpinnerAABB, tickChargerBot } from '../src/obstacle-types.js'

describe('OBSTACLE_VARIANTS', () => {
  it('exports an object of non-empty arrays', () => {
    expect(typeof OBSTACLE_VARIANTS).toBe('object')
    for (const [key, arr] of Object.entries(OBSTACLE_VARIANTS)) {
      expect(Array.isArray(arr), `${key} should be array`).toBe(true)
      expect(arr.length, `${key} needs variants`).toBeGreaterThan(0)
    }
  })

  it('each factory sets required userData', () => {
    for (const [mechanic, variants] of Object.entries(OBSTACLE_VARIANTS)) {
      for (const factory of variants) {
        const group = factory()
        expect(group.userData.type, `${mechanic} type`).toBeTruthy()
        expect(group.userData.avoidWith, `${mechanic} avoidWith`).toBeTruthy()
        const hz = group.userData.hazardAABB
        expect(hz, `${mechanic} hazardAABB`).toBeTruthy()
        for (const k of ['minX','maxX','minY','maxY','minZ','maxZ']) {
          expect(typeof hz[k], `${mechanic} hz.${k}`).toBe('number')
        }
      }
    }
  })
})

describe('calcSpinnerAABB', () => {
  it('returns safe AABB when arm points in Z direction (cosA near 0)', () => {
    // rotation.y = π/2: arm points toward player (+Z), cos(π/2)=0, thin X profile → safe
    const aabb = calcSpinnerAABB(Math.PI / 2)
    expect(aabb.minY).toBeGreaterThan(90)
  })

  it('returns active AABB when arm spans across lanes (cosA near 1)', () => {
    // rotation.y = 0: arm extends in ±X direction, cos(0)=1, spans lane → danger
    const aabb = calcSpinnerAABB(0)
    expect(aabb.minY).toBeLessThan(2)
    expect(aabb.maxY).toBeLessThan(2)
  })
})

describe('tickChargerBot', () => {
  const baseState = { chargeState: 'APPROACH', windupTimer: 0, chargeTimer: 0, time: 0 }

  it('moves normally during APPROACH', () => {
    const { dz, vibX } = tickChargerBot(baseState, 0.016, 12, -30)
    expect(dz).toBeCloseTo(0.016 * 12)
    expect(vibX).toBe(0)
  })

  it('triggers WINDUP when objZ > -20', () => {
    const { newState } = tickChargerBot(baseState, 0.016, 12, -19)
    expect(newState.chargeState).toBe('WINDUP')
  })

  it('freezes movement during WINDUP', () => {
    const windup = { ...baseState, chargeState: 'WINDUP' }
    const { dz } = tickChargerBot(windup, 0.016, 12, -10)
    expect(dz).toBe(0)
  })

  it('transitions to CHARGE after 0.5s WINDUP', () => {
    const windup = { ...baseState, chargeState: 'WINDUP', windupTimer: 0.49 }
    const { newState } = tickChargerBot(windup, 0.02, 12, -10)
    expect(newState.chargeState).toBe('CHARGE')
  })

  it('moves at 5x speed during CHARGE', () => {
    const charge = { ...baseState, chargeState: 'CHARGE' }
    const { dz } = tickChargerBot(charge, 0.016, 12, -5)
    expect(dz).toBeCloseTo(0.016 * 12 * 5)
  })
})
