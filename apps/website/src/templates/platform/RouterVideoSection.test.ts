import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { routerT } from './routerCopy'
import RouterVideoSection from './RouterVideoSection.vue'

describe('RouterVideoSection', () => {
  it('presents the explainer video with an accessible label', () => {
    render(RouterVideoSection, { props: { locale: 'en' } })

    const video = screen.getByLabelText(
      routerT('platform.router.video.alt', 'en')
    )

    expect(video).toBeTruthy()
    expect(video.hasAttribute('muted')).toBe(true)
    expect(video.hasAttribute('autoplay')).toBe(false)
  })
})
