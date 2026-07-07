import { fireEvent, render } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { InProgressItem } from '@/renderer/extensions/linearMode/linearModeTypes'
import { ResultItemImpl } from '@/stores/queueStore'

import GeneratingCard from './GeneratingCard.vue'

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
    global: { stubs: { VideoPlayOverlay: true } }
  })
}

describe('GeneratingCard', () => {
  it('shows the latent preview while generating', () => {
    const { container } = renderCard({
      id: 'c',
      jobId: 'j',
      seq: 0,
      state: 'latent',
      latentPreviewUrl: 'blob:preview'
    })
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- decorative <img> has no ARIA role
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'blob:preview'
    )
  })

  it('shows the final image output', () => {
    const out = output('result.png', 'images')
    const { container } = renderCard({
      id: 'c',
      jobId: 'j',
      seq: 0,
      state: 'image',
      output: out
    })
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- decorative <img> has no ARIA role
    expect(container.querySelector('img')).toHaveAttribute('src', out.url)
  })

  it('renders a video for video outputs instead of an image', () => {
    const out = output('clip.mp4', 'video')
    const { container } = renderCard({
      id: 'c',
      jobId: 'j',
      seq: 0,
      state: 'image',
      output: out
    })
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- <video>/<img> have no ARIA role in happy-dom
    expect(container.querySelector('img')).not.toBeInTheDocument()
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- <video> has no ARIA role in happy-dom
    expect(container.querySelector('video')).toHaveAttribute('src', out.url)
  })

  it('renders an icon for non-visual outputs', () => {
    const { container } = renderCard({
      id: 'c',
      jobId: 'j',
      seq: 0,
      state: 'image',
      output: output('sound.flac', 'audio')
    })
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- decorative media/icon have no ARIA role
    expect(container.querySelector('img')).not.toBeInTheDocument()
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- decorative media/icon have no ARIA role
    expect(container.querySelector('video')).not.toBeInTheDocument()
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- decorative icon has no ARIA role
    expect(container.querySelector('i')).toBeInTheDocument()
  })

  it('reveals the image only once it has loaded', async () => {
    const { container } = renderCard({
      id: 'c',
      jobId: 'j',
      seq: 0,
      state: 'latent',
      latentPreviewUrl: 'blob:preview'
    })
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- decorative <img> has no ARIA role
    const img = container.querySelector('img')!
    expect(img).toHaveClass('opacity-0')

    await fireEvent.load(img)
    expect(img).toHaveClass('opacity-100')
  })
})
