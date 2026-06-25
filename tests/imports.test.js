import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import * as constants from '../src/constants.js'

describe('Imports and Constants', () => {
  it('Three.js imports successfully', () => {
    expect(THREE.Scene).toBeDefined()
    expect(THREE.WebGLRenderer).toBeDefined()
  })

  it('constants.js exports required values', () => {
    expect(constants.LANES).toEqual([-2.5, 0, 2.5])
    expect(constants.BASE_SPEED).toBe(8)
    expect(constants.MAX_SPEED).toBe(22)
    expect(constants.JUMP_VELOCITY).toBe(10)
    expect(constants.GRAVITY).toBe(-22)
  })

  it('SKIN_COLORS are defined', () => {
    expect(constants.SKIN_COLORS.CYAN).toBeDefined()
    expect(constants.SKIN_COLORS.MAGENTA).toBeDefined()
    expect(constants.SKIN_COLORS.GOLD).toBeDefined()
  })

  it('POWERUP_TYPES are defined', () => {
    expect(constants.POWERUP_TYPES).toEqual(['SHIELD', 'MAGNET', 'OVERDRIVE', 'HOVER'])
  })
})
