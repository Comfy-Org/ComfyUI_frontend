// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import HeroImageCard from './HeroImageCard.vue'

class FakeImage {
  static instances: FakeImage[] = []
  src = ''
  private resolveDecode!: () => void
  readonly decoded = new Promise<void>((resolve) => {
    this.resolveDecode = resolve
  })
  constructor() {
    FakeImage.instances.push(this)
  }
  decode() {
    return this.decoded
  }
  finishDecode() {
    this.resolveDecode()
  }
}

describe('HeroImageCard', () => {
  beforeEach(() => {
    FakeImage.instances = []
    vi.stubGlobal('Image', FakeImage)
  })

  it('renders the source with its alt text, optional dot and label', () => {
    render(HeroImageCard, {
      props: { src: '/a.webp', alt: 'input render', dot: true, label: 'OUTPUT' }
    })

    expect(screen.getByAltText('input render').getAttribute('src')).toBe(
      '/a.webp'
    )
    expect(screen.getByText('OUTPUT')).toBeTruthy()
  })

  it('keeps showing the current frame until the next source has decoded', async () => {
    const { rerender } = render(HeroImageCard, {
      props: { src: '/a.webp', alt: 'render' }
    })

    await rerender({ src: '/b.webp', alt: 'render' })
    expect(screen.getByAltText('render').getAttribute('src')).toBe('/a.webp')

    FakeImage.instances.at(-1)!.finishDecode()
    await nextTick()
    await nextTick()
    expect(screen.getByAltText('render').getAttribute('src')).toBe('/b.webp')
  })

  it('drops a decode that lands after the prop has moved on', async () => {
    const { rerender } = render(HeroImageCard, {
      props: { src: '/a.webp', alt: 'render' }
    })

    await rerender({ src: '/b.webp', alt: 'render' })
    const staleLoader = FakeImage.instances.at(-1)!
    await rerender({ src: '/c.webp', alt: 'render' })
    const currentLoader = FakeImage.instances.at(-1)!

    staleLoader.finishDecode()
    await nextTick()
    await nextTick()
    expect(screen.getByAltText('render').getAttribute('src')).toBe('/a.webp')

    currentLoader.finishDecode()
    await nextTick()
    await nextTick()
    expect(screen.getByAltText('render').getAttribute('src')).toBe('/c.webp')
  })
})
