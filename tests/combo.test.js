import { describe, it, expect } from 'vitest'

// mirrors the logic in collectibles.js collect()
function shardScore(combo) {
  return 10 * Math.min(4, combo)
}

function nextCombo(current) {
  return Math.min(4, current + 1)
}

describe('combo scoring', () => {
  it('base combo gives 10 points', () => {
    expect(shardScore(1)).toBe(10)
  })
  it('combo 2 gives 20 points', () => {
    expect(shardScore(2)).toBe(20)
  })
  it('combo 4 gives 40 points', () => {
    expect(shardScore(4)).toBe(40)
  })
  it('combo caps at 4', () => {
    expect(nextCombo(4)).toBe(4)
    expect(shardScore(nextCombo(4))).toBe(40)
  })
  it('combo 5 is capped to 4', () => {
    expect(shardScore(5)).toBe(40)
  })
})
