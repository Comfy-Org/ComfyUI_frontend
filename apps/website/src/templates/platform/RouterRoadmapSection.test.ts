// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import RouterRoadmapSection from './RouterRoadmapSection.vue'

describe('RouterRoadmapSection', () => {
  it('lists all five roadmap items', () => {
    render(RouterRoadmapSection, { props: { locale: 'en' } })

    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    for (const n of [1, 2, 3, 4, 5] as const) {
      expect(
        screen.getByText(t(`platform.router.roadmap.${n}.title`, 'en'))
      ).toBeTruthy()
    }
  })
})
