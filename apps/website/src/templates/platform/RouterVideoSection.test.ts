import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { routerT } from './routerCopy'
import RouterVideoSection from './RouterVideoSection.vue'

describe('RouterVideoSection', () => {
  it('presents the explainer video with an accessible label, muted for lazy autoplay', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)

    render(RouterVideoSection, { props: { locale: 'en' } })

    const video = screen.getByLabelText(
      routerT('platform.router.video.alt', 'en')
    )

    expect(video).toBeTruthy()
    expect(video.hasAttribute('autoplay')).toBe(false)

    // No native `autoplay` attribute is rendered for a lazy-autoplay video,
    // so nothing plays before hydration; the element only becomes muted once
    // the post-mount watcher starts playback for real.
    await nextTick()
    expect((video as HTMLVideoElement).muted).toBe(true)
  })
})
