import { fireEvent, render, screen } from '@testing-library/vue'
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

  it.for([
    {
      kind: 'video' as const,
      url: '/api/view?filename=clip.mp4&type=output',
      filename: 'clip.mp4',
      testId: 'reply-video-preview'
    },
    {
      kind: 'image' as const,
      url: '/api/view?filename=cat.png&type=output',
      filename: 'cat.png',
      testId: 'reply-image-preview'
    }
  ])(
    'says the $kind could not be loaded instead of showing a blank preview',
    async ({ kind, url, filename, testId }) => {
      const { emitted } = render(ReplyVisualAsset, {
        props: {
          asset: { url, filename, kind },
          multi: false,
          modelThumbnailSrc: ''
        },
        global: { plugins: [i18n] }
      })

      await fireEvent.error(screen.getByTestId(testId))

      expect(screen.queryByTestId(testId)).toBeNull()
      expect(screen.queryByTestId('reply-video-affordance')).toBeNull()
      const button = screen.getByRole('button', {
        name: `Couldn't load ${filename}`
      })
      expect(button).toBeDisabled()
      expect(screen.getByText(`Couldn't load ${filename}`)).toBeVisible()

      await userEvent.click(button)
      expect(emitted('inspect')).toBeUndefined()
    }
  )
})
