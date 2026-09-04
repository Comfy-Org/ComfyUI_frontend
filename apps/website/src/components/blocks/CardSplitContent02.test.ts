// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import CardSplitContent02 from './CardSplitContent02.vue'

type CardSplitContentProps = ComponentProps<typeof CardSplitContent02>

const requiredProps = {
  title: 'Govern the build, models, people, and usage.',
  imageSrc: '/assets/enterprise/govern-matrix-city.webp'
} satisfies CardSplitContentProps

function renderCardSplitContent(props: Partial<CardSplitContentProps> = {}) {
  return render(CardSplitContent02, {
    props: { ...requiredProps, ...props }
  })
}

describe('CardSplitContent02', () => {
  it('renders the title as a heading and the image with the given src', () => {
    renderCardSplitContent({ imageAlt: 'Matrix city' })

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Govern the build, models, people, and usage.'
      })
    ).toBeTruthy()
    expect(screen.getByAltText('Matrix city').getAttribute('src')).toBe(
      '/assets/enterprise/govern-matrix-city.webp'
    )
  })

  it('treats the image as decorative by default (empty alt)', () => {
    renderCardSplitContent()

    expect(screen.getByRole('img').getAttribute('alt')).toBe('')
  })

  it('applies the provided image alt text', () => {
    renderCardSplitContent({ imageAlt: 'A city of circuit towers' })

    expect(screen.getByAltText('A city of circuit towers')).toBeTruthy()
  })
})
