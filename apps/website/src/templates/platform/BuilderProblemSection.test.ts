// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import BuilderProblemSection from './BuilderProblemSection.vue'

describe('BuilderProblemSection', () => {
  it('lists the four pains and the customer quote', () => {
    render(BuilderProblemSection, { props: { locale: 'en' } })

    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    expect(
      screen.getByText(t('platform.builderProblem.quote', 'en'))
    ).toBeTruthy()
  })
})
