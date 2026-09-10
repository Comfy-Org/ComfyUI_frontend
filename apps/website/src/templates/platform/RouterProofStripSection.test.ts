// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import RouterProofStripSection from './RouterProofStripSection.vue'

describe('RouterProofStripSection', () => {
  it('presents the partner logos line and supporting copy', () => {
    render(RouterProofStripSection, { props: { locale: 'en' } })

    expect(
      screen.getByText(t('platform.router.proofStrip.logos', 'en'))
    ).toBeTruthy()
    expect(
      screen.getByText(t('platform.router.proofStrip.line', 'en'))
    ).toBeTruthy()
  })
})
