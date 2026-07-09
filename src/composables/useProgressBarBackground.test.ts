import { describe, expect, it } from 'vitest'

import { useProgressBarBackground } from './useProgressBarBackground'

describe('useProgressBarBackground', () => {
  it('identifies finite progress values', () => {
    const { hasProgressPercent, hasAnyProgressPercent } =
      useProgressBarBackground()

    expect(hasProgressPercent(undefined)).toBe(false)
    expect(hasProgressPercent(Number.NaN)).toBe(false)
    expect(hasProgressPercent(0)).toBe(true)
    expect(hasAnyProgressPercent(undefined, Number.POSITIVE_INFINITY)).toBe(
      false
    )
    expect(hasAnyProgressPercent(undefined, 42)).toBe(true)
  })

  it('clamps progress styles to the valid percent range', () => {
    const { progressPercentStyle } = useProgressBarBackground()

    expect(progressPercentStyle(undefined)).toBeUndefined()
    expect(progressPercentStyle(-10)).toEqual({ width: '0%' })
    expect(progressPercentStyle(125)).toEqual({ width: '100%' })
    expect(progressPercentStyle(37)).toEqual({ width: '37%' })
  })
})
