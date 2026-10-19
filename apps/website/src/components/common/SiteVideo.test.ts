import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import SiteVideo from './SiteVideo.vue'

describe('SiteVideo', () => {
  it.for([false, true])(
    'renders with autoplay %s and follows prop changes',
    async (autoplay) => {
      const { rerender } = render(SiteVideo, {
        props: { name: 'hero', baseUrl: '/media', alt: 'Preview', autoplay }
      })
      const video = screen.getByLabelText<HTMLVideoElement>('Preview')
      expect(video.muted).toBe(autoplay)
      expect(video.preload).toBe(autoplay ? 'auto' : 'metadata')
      await rerender({ autoplay: !autoplay })
      expect(video.muted).toBe(!autoplay)
      expect(video.preload).toBe(autoplay ? 'metadata' : 'auto')
      await rerender({ muted: false, preload: 'none', autoplay: true })
      expect(video.muted).toBe(false)
      expect(video.preload).toBe('none')
    }
  )
})
