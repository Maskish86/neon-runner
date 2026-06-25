import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { boxesOverlap } from '../src/collision.js'

describe('boxesOverlap', () => {
  it('returns true for overlapping boxes', () => {
    const a = new THREE.Box3(new THREE.Vector3(0,0,0), new THREE.Vector3(1,1,1))
    const b = new THREE.Box3(new THREE.Vector3(0.5,0.5,0.5), new THREE.Vector3(1.5,1.5,1.5))
    expect(boxesOverlap(a, b)).toBe(true)
  })

  it('returns false for non-overlapping boxes', () => {
    const a = new THREE.Box3(new THREE.Vector3(0,0,0), new THREE.Vector3(1,1,1))
    const b = new THREE.Box3(new THREE.Vector3(2,2,2), new THREE.Vector3(3,3,3))
    expect(boxesOverlap(a, b)).toBe(false)
  })

  it('returns false for boxes that only touch edges', () => {
    const a = new THREE.Box3(new THREE.Vector3(0,0,0), new THREE.Vector3(1,1,1))
    const b = new THREE.Box3(new THREE.Vector3(1,0,0), new THREE.Vector3(2,1,1))
    expect(boxesOverlap(a, b)).toBe(false)
  })
})
