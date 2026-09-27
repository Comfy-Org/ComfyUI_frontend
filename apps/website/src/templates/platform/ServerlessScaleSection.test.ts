// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import ServerlessScaleSection from './ServerlessScaleSection.vue'

describe('ServerlessScaleSection', () => {
  it('presents the three scale features', () => {
    render(ServerlessScaleSection, { props: { locale: 'en' } })

    for (const n of [1, 2, 3] as const) {
      expect(
        screen.getByText(t(`platform.serverlessScale.${n}.title`, 'en'))
      ).toBeTruthy()
    }
  })
})
