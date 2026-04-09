import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ImageComparePreview from '@/renderer/extensions/linearMode/ImageComparePreview.vue'
import type { CompareImages } from '@/stores/queueStore'
import { ResultItemImpl } from '@/stores/queueStore'

function makeResultItem(filename: string): ResultItemImpl {
  return new ResultItemImpl({
    filename,
    subfolder: '',
    type: 'output',
    mediaType: 'images',
    nodeId: '1'
  })
}

function makeCompareImages(
  beforeFiles: string[],
  afterFiles: string[]
): CompareImages {
  return {
    before: beforeFiles.map(makeResultItem),
    after: afterFiles.map(makeResultItem)
  }
}

function mountComponent(compareImages: CompareImages) {
  return mount(ImageComparePreview, {
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

describe('ImageComparePreview', () => {
  it('renders both before and after images', () => {
    const compareImages = makeCompareImages(['before.png'], ['after.png'])
    const wrapper = mountComponent(compareImages)

    const images = wrapper.findAll('img')
    expect(images).toHaveLength(2)
    expect(images[0].attributes('alt')).toBe('imageCompare.altAfter')
    expect(images[1].attributes('alt')).toBe('imageCompare.altBefore')
  })

  it('renders slider handle when both images present', () => {
    const compareImages = makeCompareImages(['before.png'], ['after.png'])
    const wrapper = mountComponent(compareImages)

    const handles = wrapper.findAll('[role="presentation"]')
    expect(handles.length).toBeGreaterThanOrEqual(1)
  })

  it('renders only before image when no after images', () => {
    const compareImages = makeCompareImages(['before.png'], [])
    const wrapper = mountComponent(compareImages)

    const images = wrapper.findAll('img')
    expect(images).toHaveLength(1)
    expect(images[0].attributes('alt')).toBe('imageCompare.altBefore')
  })

  it('renders only after image when no before images', () => {
    const compareImages = makeCompareImages([], ['after.png'])
    const wrapper = mountComponent(compareImages)

    const images = wrapper.findAll('img')
    expect(images).toHaveLength(1)
    expect(images[0].attributes('alt')).toBe('imageCompare.altAfter')
  })

  it('shows no-images message when both arrays are empty', () => {
    const compareImages = makeCompareImages([], [])
    const wrapper = mountComponent(compareImages)

    expect(wrapper.findAll('img')).toHaveLength(0)
    expect(wrapper.text()).toContain('imageCompare.noImages')
  })

  it('hides batch nav for single images', () => {
    const compareImages = makeCompareImages(['before.png'], ['after.png'])
    const wrapper = mountComponent(compareImages)

    expect(wrapper.find('[data-testid="batch-nav"]').exists()).toBe(false)
  })

  it('shows batch nav when multiple images on either side', () => {
    const compareImages = makeCompareImages(['a1.png', 'a2.png'], ['b1.png'])
    const wrapper = mountComponent(compareImages)

    expect(wrapper.find('[data-testid="batch-nav"]').exists()).toBe(true)
  })

  it('navigates before images with batch controls', async () => {
    const compareImages = makeCompareImages(
      ['a1.png', 'a2.png', 'a3.png'],
      ['b1.png']
    )
    const wrapper = mountComponent(compareImages)
    const beforeBatch = wrapper.find('[data-testid="before-batch"]')

    await beforeBatch.find('[data-testid="batch-next"]').trigger('click')

    expect(beforeBatch.find('[data-testid="batch-counter"]').text()).toBe(
      '2 / 3'
    )
  })

  it('does not render slider handle when only one side has images', () => {
    const compareImages = makeCompareImages(['before.png'], [])
    const wrapper = mountComponent(compareImages)

    expect(wrapper.find('[role="presentation"]').exists()).toBe(false)
  })
})
