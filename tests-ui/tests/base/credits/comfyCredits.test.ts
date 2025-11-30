import { describe, expect, it } from 'vitest'

import {
  COMFY_CREDIT_RATE_CENTS,
  COMFY_CREDIT_RATE_USD,
  centsToComfyCredits,
  comfyCreditsToCents,
  comfyCreditsToUsd,
  convertUsdLabelToCredits,
  formatComfyCreditsAmount,
  formatComfyCreditsLabel,
  formatComfyCreditsRangeLabelFromUsd,
  usdToComfyCredits
} from '@/base/credits/comfyCredits'

describe('comfyCredits helpers', () => {
  it('exposes the fixed conversion rate', () => {
    expect(COMFY_CREDIT_RATE_CENTS).toBe(210)
    expect(COMFY_CREDIT_RATE_USD).toBeCloseTo(2.1)
  })

  it('converts USD and cents to credits', () => {
    expect(usdToComfyCredits(2.1)).toBeCloseTo(1)
    expect(usdToComfyCredits(10.5)).toBeCloseTo(5)
    expect(centsToComfyCredits(210)).toBeCloseTo(1)
    expect(centsToComfyCredits(1050)).toBeCloseTo(5)
  })

  it('converts credits back to USD and cents', () => {
    expect(comfyCreditsToUsd(1)).toBeCloseTo(2.1)
    expect(comfyCreditsToUsd(3.5)).toBeCloseTo(7.35)
    expect(comfyCreditsToCents(1)).toBe(210)
    expect(comfyCreditsToCents(3.5)).toBeCloseTo(735)
  })

  it('formats credits with localized precision', () => {
    expect(formatComfyCreditsAmount(1234.5678)).toBe('1,234.57')
    expect(
      formatComfyCreditsLabel(1.2345, {
        unit: 'credits',
        numberOptions: { maximumFractionDigits: 1 }
      })
    ).toBe('1.2 credits')
  })

  it('formats ranges and USD strings into credits', () => {
    expect(formatComfyCreditsRangeLabelFromUsd(2.1, 4.2)).toBe(
      '1.00–2.00 credits'
    )
    expect(convertUsdLabelToCredits('$2.10/Run')).toBe('1.00 credits/Run')
    expect(convertUsdLabelToCredits('~$2.10-$4.20/Run')).toBe(
      '~1.00–2.00 credits/Run'
    )
  })
})
