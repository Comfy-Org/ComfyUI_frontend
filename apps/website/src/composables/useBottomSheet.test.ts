import { describe, expect, it } from 'vitest'

import { heightAt, restAt } from './useBottomSheet'

describe('restAt', () => {
  it('puts the sheet away only once it is dragged well below its resting height', () => {
    expect(restAt(0.1)).toBe('closed')
    expect(restAt(0.33)).toBe('closed')
    expect(restAt(0.35)).toBe('collapsed')
  })

  it('settles at whichever height the drag ended nearer to', () => {
    expect(restAt(0.6)).toBe('collapsed')
    expect(restAt(0.9)).toBe('expanded')
    expect(restAt(1)).toBe('expanded')
  })
})

describe('heightAt', () => {
  it('gives a taller sheet when expanded, in whole pixels of the screen', () => {
    const collapsed = heightAt('collapsed', 851)
    const expanded = heightAt('expanded', 851)

    expect(expanded).toBeGreaterThan(collapsed)
    expect(expanded).toBeLessThan(851)
    expect(Number.isInteger(collapsed)).toBe(true)
  })

  it('reads back as the rest it was asked for', () => {
    for (const rest of ['collapsed', 'expanded'] as const)
      expect(restAt(heightAt(rest, 851) / 851)).toBe(rest)
  })
})
