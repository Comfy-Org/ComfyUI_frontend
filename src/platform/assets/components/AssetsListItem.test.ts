import { describe, expect, it } from 'vitest'

import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'

import AssetsListItem from './AssetsListItem.vue'

describe('AssetsListItem', () => {
  it('renders video element with play overlay for video previews', () => {
    const { container } = render(AssetsListItem, {
      props: {
        previewUrl: 'https://example.com/preview.mp4',
        previewAlt: 'clip.mp4',
        isVideoPreview: true
      }
    })

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- no ARIA role for <video> in happy-dom
    const video = container.querySelector('video')
    expect(video).toBeInTheDocument()
    expect(video).toHaveAttribute('src', 'https://example.com/preview.mp4')
    expect(video).toHaveAttribute('preload', 'metadata')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- CSS class query for play overlay styling
    expect(container.querySelector('.bg-black\\/15')).toBeInTheDocument()
    expect(
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- CSS class query for play icon styling
      container.querySelector('.icon-\\[lucide--play\\]')
    ).toBeInTheDocument()
  })

  it('does not show play overlay for non-video previews', () => {
    const { container } = render(AssetsListItem, {
      props: {
        previewUrl: 'https://example.com/preview.jpg',
        previewAlt: 'image.png',
        isVideoPreview: false
      }
    })

    expect(screen.getByRole('img')).toBeInTheDocument()
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- no ARIA role for <video> in happy-dom
    expect(container.querySelector('video')).not.toBeInTheDocument()
    expect(
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- CSS class query for play icon styling
      container.querySelector('.icon-\\[lucide--play\\]')
    ).not.toBeInTheDocument()
  })

  it('emits preview-click when preview is clicked', async () => {
    const user = userEvent.setup()
    const { emitted } = render(AssetsListItem, {
      props: {
        previewUrl: 'https://example.com/preview.jpg',
        previewAlt: 'image.png'
      }
    })

    await user.click(screen.getByRole('img'))

    expect(emitted()['preview-click']).toHaveLength(1)
  })

  it('emits preview-click when fallback icon is clicked', async () => {
    const user = userEvent.setup()
    const { container, emitted } = render(AssetsListItem, {
      props: {
        iconName: 'icon-[lucide--box]'
      }
    })

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- aria-hidden icon, no semantic query available
    const icon = container.querySelector('i')!
    await user.click(icon)

    expect(emitted()['preview-click']).toHaveLength(1)
  })
})
