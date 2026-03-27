import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import AudioThumbnail from '@/components/templates/thumbnails/AudioThumbnail.vue'

vi.mock('@/components/templates/thumbnails/BaseThumbnail.vue', () => ({
  default: {
    name: 'BaseThumbnail',
    template: '<div class="base-thumbnail"><slot /></div>'
  }
}))

describe('AudioThumbnail', () => {
  function renderThumbnail(props = {}) {
    return render(AudioThumbnail, {
      props: {
        src: '/test-audio.mp3',
        ...props
      }
    })
  }

  it('renders an audio element with correct src', () => {
    renderThumbnail()
    const audio = screen.getByTestId('audio-player')
    expect(audio).toBeInTheDocument()
    expect(audio).toHaveAttribute('src', '/test-audio.mp3')
  })
})
