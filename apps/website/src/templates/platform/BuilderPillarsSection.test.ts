// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import BuilderPillarsSection from './BuilderPillarsSection.vue'

describe('BuilderPillarsSection', () => {
  it('presents the four builder pillars', () => {
    render(BuilderPillarsSection, { props: { locale: 'en' } })

    for (const n of [1, 2, 3, 4] as const) {
      expect(
        screen.getByText(t(`platform.builderPillars.${n}.title`, 'en'))
      ).toBeTruthy()
    }
  })
})
