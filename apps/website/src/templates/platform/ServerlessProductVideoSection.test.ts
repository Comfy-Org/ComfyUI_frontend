import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import ServerlessProductVideoSection from './ServerlessProductVideoSection.vue'

describe('ServerlessProductVideoSection', () => {
  it('autoplays the hosted video muted with player controls', async () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockResolvedValue(undefined)

    render(ServerlessProductVideoSection, { props: { locale: 'en' } })

    const video = screen.getByLabelText<HTMLVideoElement>(
      'Comfy API product demo',
      { selector: 'video' }
    )

    expect(video.src).toBe(
      'https://media.comfy.org/website/comfy-api/comfy-api-product-demo.mp4'
    )
    await vi.waitFor(() => expect(play).toHaveBeenCalled())
    expect(video.muted).toBe(true)
    expect(screen.getByTestId('player-control-bar')).toBeTruthy()
    expect(await screen.findByRole('button', { name: 'Unmute' })).toBeTruthy()
  })

  it('uses the English label for Japanese', () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    render(ServerlessProductVideoSection, { props: { locale: 'ja' } })

    expect(
      screen.getByLabelText<HTMLVideoElement>('Comfy API product demo', {
        selector: 'video'
      })
    ).toBeTruthy()
  })
})
