import { describe, it, expect } from 'vitest'
import { calcProximityDelta } from '../src/drone.js'

describe('calcProximityDelta', () => {
  it('increases proximity on obstacle hit', () => {
    const delta = calcProximityDelta({ hitObstacle: true, evaded: false, overdrive: false }, 0.016)
    expect(delta).toBeGreaterThan(0)
  })

  it('decreases proximity on successful evasion', () => {
    const delta = calcProximityDelta({ hitObstacle: false, evaded: true, overdrive: false }, 0.016)
    expect(delta).toBeLessThan(0)
  })

  it('strongly decreases proximity on overdrive', () => {
    const delta = calcProximityDelta({ hitObstacle: false, evaded: false, overdrive: true }, 0.016)
    expect(delta).toBeLessThan(-0.1)
  })
})
