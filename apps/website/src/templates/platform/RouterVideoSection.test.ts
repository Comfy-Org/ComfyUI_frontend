import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import RouterVideoSection from './RouterVideoSection.vue'

describe('RouterVideoSection', () => {
  it('presents the explainer video with an accessible label', () => {
    render(RouterVideoSection, { props: { locale: 'en' } })

    expect(
      screen.getByLabelText(t('platform.router.video.alt', 'en'))
    ).toBeTruthy()
  })
})
