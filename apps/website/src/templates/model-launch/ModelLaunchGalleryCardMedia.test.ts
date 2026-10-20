import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { ModelLaunchGalleryCard } from './types'

import ModelLaunchGalleryCardMedia from './ModelLaunchGalleryCardMedia.vue'

const card: ModelLaunchGalleryCard = {
  id: 'pipeline',
  name: { en: 'Pipeline', 'zh-CN': '流程' },
  tier: 'free',
  note: { en: 'Runs locally', 'zh-CN': '本地运行' },
  description: { en: 'The pipeline.', 'zh-CN': '流程。' },
  media: { kind: 'image', src: '/pipeline.jpg' },
  href: 'https://comfy.org/download/'
}

describe('ModelLaunchGalleryCardMedia', () => {
  it('fits a full-span image inside the card below md and covers from md up', () => {
    render(ModelLaunchGalleryCardMedia, {
      props: { card: { ...card, span: 'full' } }
    })

    const image = screen.getByRole('img', { name: 'Pipeline' })
    expect(image).toHaveClass('object-contain', 'md:object-cover')
    expect(image).not.toHaveClass('object-cover')
  })

  it('covers the card with an image that does not span the full row', () => {
    render(ModelLaunchGalleryCardMedia, { props: { card } })

    const image = screen.getByRole('img', { name: 'Pipeline' })
    expect(image).toHaveClass('object-cover')
    expect(image).not.toHaveClass('object-contain')
  })

  it('renders a full-span video card as a video with no image', () => {
    render(ModelLaunchGalleryCardMedia, {
      props: {
        card: {
          ...card,
          span: 'full',
          media: { kind: 'video', src: '/pipeline.mp4' }
        }
      }
    })

    expect(screen.getByLabelText('Pipeline').tagName).toBe('VIDEO')
    expect(screen.queryByRole('img')).toBeNull()
  })
})
