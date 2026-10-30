import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import ReplyVisualAsset from './ReplyVisualAsset.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  escapeParameter: true,
  messages: { en: enMessages }
})

describe('ReplyVisualAsset', () => {
  it('plays a video on hover and pauses it on leave', async () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockResolvedValue()
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, 'pause')
      .mockImplementation(() => {})
    render(ReplyVisualAsset, {
      props: {
        asset: {
          url: 'https://example.com/clip.mp4',
          filename: 'clip.mp4',
          kind: 'video'
        },
        multi: false,
        modelThumbnailSrc: ''
      },
      global: { plugins: [i18n] }
    })
    const video = screen.getByTestId('reply-video-preview')

    await userEvent.hover(video)
    expect(play).toHaveBeenCalledOnce()

    await userEvent.unhover(video)
    expect(pause).toHaveBeenCalledOnce()
  })
})
