import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import BaseThumbnail from '@/components/templates/thumbnails/BaseThumbnail.vue'

describe('BaseThumbnail', () => {
  function renderThumbnail(props = {}) {
    return render(BaseThumbnail, {
      props,
      slots: {
        default: '<img src="/test.jpg" alt="test" />'
      }
    })
  }

  it('renders slot content', () => {
    renderThumbnail()
    expect(screen.getByAltText('test')).toBeTruthy()
  })

  it('applies hover zoom with correct style', () => {
    const { container } = renderThumbnail({ isHovered: true })
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const contentDiv = container.querySelector('.transform-gpu')
    expect(contentDiv).toHaveStyle({ transform: 'scale(1.04)' })
  })

  it('applies custom hover zoom value', () => {
    const { container } = renderThumbnail({ hoverZoom: 10, isHovered: true })
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const contentDiv = container.querySelector('.transform-gpu')
    expect(contentDiv).toHaveStyle({ transform: 'scale(1.1)' })
  })

  it('does not apply scale when not hovered', () => {
    const { container } = renderThumbnail({ isHovered: false })
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const contentDiv = container.querySelector('.transform-gpu')
    expect(contentDiv).not.toHaveStyle({ transform: expect.any(String) })
  })

  it('shows error state when image fails to load', async () => {
    renderThumbnail()
    const img = screen.getByAltText('test')
    await fireEvent.error(img)
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      '/assets/images/default-template.png'
    )
  })
})
