import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { InProgressItem } from '@/renderer/extensions/linearMode/linearModeTypes'
import { ResultItemImpl } from '@/stores/queueStore'

import GeneratingCard from './GeneratingCard.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function output(filename: string, mediaType: string): ResultItemImpl {
  return new ResultItemImpl({
    filename,
    subfolder: '',
    type: 'output',
    nodeId: '1',
    mediaType
  })
}

function renderCard(card: InProgressItem) {
  return render(GeneratingCard, {
    props: { card, depth: 0, total: 1 },
    global: { plugins: [i18n], stubs: { VideoPlayOverlay: true } }
  })
}

describe('GeneratingCard', () => {
  it('shows the latent preview while generating', () => {
    renderCard({
      id: 'c',
      jobId: 'j',
      seq: 0,
      state: 'latent',
      latentPreviewUrl: 'blob:preview'
    })
    expect(screen.getByAltText('Generation preview')).toHaveAttribute(
      'src',
      'blob:preview'
    )
  })

  it('shows the final image output', () => {
    const out = output('result.png', 'images')
    renderCard({
      id: 'c',
      jobId: 'j',
      seq: 0,
      state: 'image',
      output: out
    })
    expect(screen.getByAltText('result.png')).toHaveAttribute('src', out.url)
  })

  it('renders a video for video outputs instead of an image', () => {
    const out = output('clip.mp4', 'video')
    renderCard({
      id: 'c',
      jobId: 'j',
      seq: 0,
      state: 'image',
      output: out
    })
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByLabelText('clip.mp4')).toHaveAttribute('src', out.url)
  })

  it('renders an icon for non-visual outputs', () => {
    renderCard({
      id: 'c',
      jobId: 'j',
      seq: 0,
      state: 'image',
      output: output('sound.flac', 'audio')
    })
    expect(screen.queryByAltText('sound.flac')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Audio' })).toBeInTheDocument()
  })

  it('reveals the image only once it has loaded', async () => {
    renderCard({
      id: 'c',
      jobId: 'j',
      seq: 0,
      state: 'latent',
      latentPreviewUrl: 'blob:preview'
    })
    const img = screen.getByAltText('Generation preview')
    expect(img).toHaveClass('opacity-0')

    await fireEvent.load(img)
    expect(img).toHaveClass('opacity-100')
  })
})
