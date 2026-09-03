// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../../i18n/translations'
import MinimaxLicenseBandSection from './MinimaxLicenseBandSection.vue'

describe('MinimaxLicenseBandSection', () => {
  it('links the license page at its canonical English path', () => {
    render(MinimaxLicenseBandSection)

    const cta = screen.getByRole('link', {
      name: t('enterprise.minimaxBand.cta')
    })
    expect(cta.getAttribute('href')).toBe('/minimax/license')
  })

  it('links the localized license page for zh-CN', () => {
    render(MinimaxLicenseBandSection, { props: { locale: 'zh-CN' } })

    const cta = screen.getByRole('link', {
      name: t('enterprise.minimaxBand.cta', 'zh-CN')
    })
    expect(cta.getAttribute('href')).toBe('/zh-CN/minimax/license')
  })
})
