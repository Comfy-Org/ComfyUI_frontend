import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import { routerT } from './routerCopy'
import RouterVideoSection from './RouterVideoSection.vue'

describe('RouterVideoSection', () => {
  it('presents the explainer video with an accessible label', () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)

    render(RouterVideoSection, { props: { locale: 'en' } })

    const video = screen.getByLabelText(
      routerT('platform.router.video.alt', 'en')
    )

    expect(video).toBeTruthy()
    expect(video.hasAttribute('muted')).toBe(true)
    // The section now sits right below the hero, so it loads eagerly
    // (native `autoplay`) instead of waiting on `lazy-autoplay` + scroll.
    expect(video.hasAttribute('autoplay')).toBe(true)
  })
})
