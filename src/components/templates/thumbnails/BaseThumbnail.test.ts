import { fireEvent, render, screen } from '@testing-library/vue'
import type { ComponentProps } from 'vue-component-type-helpers'
import { describe, expect, it } from 'vitest'

import BaseThumbnail from '@/components/templates/thumbnails/BaseThumbnail.vue'

describe('BaseThumbnail', () => {
  function renderThumbnail(
    props: Partial<ComponentProps<typeof BaseThumbnail>> = {}
  ) {
    return render(BaseThumbnail, {
      props: props as ComponentProps<typeof BaseThumbnail>,
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
    renderThumbnail({ isHovered: true })
    const contentDiv = screen.getByTestId('thumbnail-content')
    expect(contentDiv).toHaveStyle({ transform: 'scale(1.04)' })
  })

  it('applies custom hover zoom value', () => {
    renderThumbnail({ hoverZoom: 10, isHovered: true })
    const contentDiv = screen.getByTestId('thumbnail-content')
    expect(contentDiv).toHaveStyle({ transform: 'scale(1.1)' })
  })

  it('does not apply scale when not hovered', () => {
    renderThumbnail({ isHovered: false })
    const contentDiv = screen.getByTestId('thumbnail-content')
    expect(contentDiv).not.toHaveAttribute('style')
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
