import { mount } from '@vue/test-utils'
import { describe, expect, it, onTestFinished } from 'vitest'

import ImageComparePreview from '@/renderer/extensions/linearMode/ImageComparePreview.vue'
import { makeResultItem } from '@/renderer/extensions/linearMode/__fixtures__/testResultItemFactory'
import type { CompareImages } from '@/stores/queueStore'

function makeCompareImages(
  beforeFiles: string[],
  afterFiles: string[]
): CompareImages {
  return {
    before: beforeFiles.map((f) => makeResultItem({ filename: f })),
    after: afterFiles.map((f) => makeResultItem({ filename: f }))
  }
}

function mountComponent(
  compareImages: CompareImages,
  { attachTo }: { attachTo?: HTMLElement } = {}
) {
  return mount(ImageComparePreview, {
    attachTo,
    global: {
      mocks: {
        $t: (key: string, params?: Record<string, unknown>) => {
          if (key === 'batch.index' && params) {
            return `${params.current} / ${params.total}`
          }
          return key
        }
      }
    },
    props: { compareImages }
  })
}

function mountAttached(compareImages: CompareImages) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const wrapper = mountComponent(compareImages, { attachTo: host })
  onTestFinished(() => {
    wrapper.unmount()
    host.remove()
  })
  return wrapper
}

describe('ImageComparePreview', () => {
  it('renders split view with slider when both sides have images', () => {
    const wrapper = mountComponent(
      makeCompareImages(['before.png'], ['after.png'])
    )

    const images = wrapper.findAll('img')
    expect(images).toHaveLength(2)
    expect(images[0].attributes('alt')).toBe('imageCompare.altAfter')
    expect(images[1].attributes('alt')).toBe('imageCompare.altBefore')

    expect(wrapper.find('[data-testid="image-compare-slider"]').exists()).toBe(
      true
    )
    expect(wrapper.find('[data-testid="batch-nav"]').exists()).toBe(false)
  })

  it('renders single image without slider when only one side has images', () => {
    const before = mountComponent(makeCompareImages(['before.png'], []))
    expect(before.findAll('img')).toHaveLength(1)
    expect(before.find('img').attributes('alt')).toBe('imageCompare.altBefore')
    expect(before.find('[data-testid="image-compare-slider"]').exists()).toBe(
      false
    )

    const after = mountComponent(makeCompareImages([], ['after.png']))
    expect(after.findAll('img')).toHaveLength(1)
    expect(after.find('img').attributes('alt')).toBe('imageCompare.altAfter')
  })

  it('shows no-images message when both arrays are empty', () => {
    const wrapper = mountComponent(makeCompareImages([], []))

    expect(wrapper.findAll('img')).toHaveLength(0)
    expect(wrapper.text()).toContain('imageCompare.noImages')
  })

  it('shows batch nav and navigates when multiple images on a side', async () => {
    const wrapper = mountComponent(
      makeCompareImages(['a1.png', 'a2.png', 'a3.png'], ['b1.png'])
    )

    expect(wrapper.find('[data-testid="batch-nav"]').exists()).toBe(true)

    const beforeBatch = wrapper.find('[data-testid="before-batch"]')
    await beforeBatch.find('[data-testid="batch-next"]').trigger('click')

    expect(beforeBatch.find('[data-testid="batch-counter"]').text()).toBe(
      '2 / 3'
    )
  })

  it('resets slider and aspect ratio when compareImages changes', async () => {
    const wrapper = mountAttached(makeCompareImages(['a.png'], ['b.png']))

    const container = wrapper.find('[data-testid="image-compare-preview"]')
    const el = container.element as HTMLElement
    el.getBoundingClientRect = () =>
      DOMRect.fromRect({ x: 0, y: 0, width: 200, height: 100 })

    // Set aspect ratio via load event
    const img = wrapper.find('img')
    Object.defineProperty(img.element, 'naturalWidth', { value: 800 })
    Object.defineProperty(img.element, 'naturalHeight', { value: 600 })
    await img.trigger('load')
    expect(container.attributes('style')).toContain('800 / 600')

    el.dispatchEvent(new PointerEvent('pointermove', { clientX: 150 }))
    await wrapper.vm.$nextTick()
    expect(
      wrapper.find('[data-testid="image-compare-slider"]').attributes('style')
    ).toContain('left: 75%')

    // Change props — both slider and aspect should reset
    await wrapper.setProps({
      compareImages: makeCompareImages(['c.png'], ['d.png'])
    })

    expect(
      wrapper.find('[data-testid="image-compare-slider"]').attributes('style')
    ).toContain('50%')
    expect(
      wrapper.find('[data-testid="image-compare-preview"]').attributes('style')
    ).toBeUndefined()
  })

  it('moves slider on pointermove and clamps to 0-100 range', async () => {
    const wrapper = mountAttached(
      makeCompareImages(['before.png'], ['after.png'])
    )

    const container = wrapper.find('[data-testid="image-compare-preview"]')
    const el = container.element as HTMLElement
    el.getBoundingClientRect = () =>
      DOMRect.fromRect({ x: 100, y: 0, width: 200, height: 100 })

    // Wait for component's pointermove listener to be registered
    await wrapper.vm.$nextTick()

    // Pointer at 150 → (150-100)/200 = 25%
    el.dispatchEvent(new PointerEvent('pointermove', { clientX: 150 }))
    await wrapper.vm.$nextTick()

    const slider = wrapper.find('[data-testid="image-compare-slider"]')
    expect(slider.attributes('style')).toContain('left: 25%')

    // Pointer before left edge → clamps to 0%
    el.dispatchEvent(new PointerEvent('pointermove', { clientX: 50 }))
    await wrapper.vm.$nextTick()
    expect(slider.attributes('style')).toContain('left: 0%')
  })

  it('sets aspect ratio from image natural dimensions on load', async () => {
    const wrapper = mountComponent(
      makeCompareImages(['before.png'], ['after.png'])
    )

    const img = wrapper.find('img')
    Object.defineProperty(img.element, 'naturalWidth', { value: 800 })
    Object.defineProperty(img.element, 'naturalHeight', { value: 600 })
    await img.trigger('load')

    expect(
      wrapper.find('[data-testid="image-compare-preview"]').attributes('style')
    ).toContain('800 / 600')
  })

  it('does not set aspect ratio when natural dimensions are zero', async () => {
    const wrapper = mountComponent(
      makeCompareImages(['before.png'], ['after.png'])
    )

    const img = wrapper.find('img')
    Object.defineProperty(img.element, 'naturalWidth', { value: 0 })
    Object.defineProperty(img.element, 'naturalHeight', { value: 0 })
    await img.trigger('load')

    expect(
      wrapper.find('[data-testid="image-compare-preview"]').attributes('style')
    ).toBeUndefined()
  })

  it('clamps beforeIndex when compareImages shrinks', async () => {
    const wrapper = mountComponent(
      makeCompareImages(['a1.png', 'a2.png', 'a3.png'], ['b1.png'])
    )

    const beforeBatch = wrapper.find('[data-testid="before-batch"]')
    await beforeBatch.find('[data-testid="batch-next"]').trigger('click')
    await beforeBatch.find('[data-testid="batch-next"]').trigger('click')
    expect(beforeBatch.find('[data-testid="batch-counter"]').text()).toBe(
      '3 / 3'
    )

    await wrapper.setProps({
      compareImages: makeCompareImages(['x.png'], ['b1.png'])
    })

    const beforeImg = wrapper
      .findAll('img')
      .find((img) => img.attributes('alt') === 'imageCompare.altBefore')
    expect(beforeImg?.attributes('src')).toContain('x.png')
  })
})
