import { describe, it, expect } from 'vitest'

// mirrors threshold logic in collectibles.js collect()
function comboBonus(count) {
  if (count % 20 === 0) return 250
  if (count % 10 === 0) return 100
  if (count % 5 === 0)  return 50
  return 0
}

describe('combo bonus thresholds', () => {
  it('no bonus below 5', () => {
    expect(comboBonus(1)).toBe(0)
    expect(comboBonus(4)).toBe(0)
  })
  it('5th shard gives +50', () => {
    expect(comboBonus(5)).toBe(50)
  })
  it('10th shard gives +100 (not +50)', () => {
    expect(comboBonus(10)).toBe(100)
  })
  it('15th shard gives +50', () => {
    expect(comboBonus(15)).toBe(50)
  })
  it('20th shard gives +250 (not +100 or +50)', () => {
    expect(comboBonus(20)).toBe(250)
  })
  it('25th shard gives +50', () => {
    expect(comboBonus(25)).toBe(50)
  })
  it('40th shard gives +250 (multiple of 20)', () => {
    expect(comboBonus(40)).toBe(250)
  })
  it('60th shard gives +250', () => {
    expect(comboBonus(60)).toBe(250)
  })
})
