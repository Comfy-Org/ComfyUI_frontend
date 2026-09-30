import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import { t } from '../../i18n/translations'
import ServerlessProductVideoSection from './ServerlessProductVideoSection.vue'

describe('ServerlessProductVideoSection', () => {
  it('autoplays the hosted video muted with player controls', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)

    render(ServerlessProductVideoSection, { props: { locale: 'en' } })

    const video = screen.getByLabelText(
      t('platform.serverlessVideo.label', 'en')
    )
    if (!(video instanceof HTMLVideoElement)) {
      throw new Error('Expected the labelled video element')
    }

    expect(video.src).toBe(
      'https://media.comfy.org/website/comfy-api/comfy-api-product-demo.mp4'
    )
    expect(video.autoplay).toBe(true)
    expect(video.muted).toBe(true)
    expect(screen.getByTestId('player-control-bar')).toBeTruthy()
    expect(await screen.findByRole('button', { name: 'Unmute' })).toBeTruthy()
  })
})
