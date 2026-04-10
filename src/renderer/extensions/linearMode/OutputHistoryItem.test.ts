import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import OutputHistoryItem from '@/renderer/extensions/linearMode/OutputHistoryItem.vue'
import { makeResultItem } from '@/renderer/extensions/linearMode/__fixtures__/testResultItemFactory'
import type { ResultItemImpl } from '@/stores/queueStore'

function mountComponent(output: ResultItemImpl) {
  return mount(OutputHistoryItem, {
    props: { output }
  })
}

describe('OutputHistoryItem', () => {
  it('renders split 50/50 thumbnail for image_compare items', () => {
    const before = [makeResultItem({ filename: 'before.png' })]
    const after = [makeResultItem({ filename: 'after.png' })]
    const output = makeResultItem({
      mediaType: 'image_compare',
      compareImages: { before, after }
    })

    const wrapper = mountComponent(output)

    const images = wrapper.findAll('img')
    expect(images).toHaveLength(2)
    expect(images[0].attributes('src')).toContain('before.png')
    expect(images[1].attributes('src')).toContain('after.png')
  })

  it('renders image thumbnail for regular image items', () => {
    const output = makeResultItem({ filename: 'photo.png' })

    const wrapper = mountComponent(output)

    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toContain('photo.png')
  })

  it('renders video element for video output', () => {
    const output = makeResultItem({ filename: 'clip.mp4', mediaType: 'video' })

    const wrapper = mountComponent(output)

    const video = wrapper.find('[data-testid="linear-video-output"]')
    expect(video.exists()).toBe(true)
    expect(video.element.tagName).toBe('VIDEO')
    expect(video.attributes('src')).toContain('clip.mp4')
  })

  it('renders fallback icon when image_compare has no compareImages', () => {
    const output = makeResultItem({ mediaType: 'image_compare' })

    const wrapper = mountComponent(output)

    expect(wrapper.find('[data-testid="linear-compare-output"]').exists()).toBe(
      false
    )
    const icon = wrapper.find('i')
    expect(icon.exists()).toBe(true)
  })

  it('renders single image when only before side of compare has data', () => {
    const wrapper = mountComponent(
      makeResultItem({
        mediaType: 'image_compare',
        compareImages: {
          before: [makeResultItem({ filename: 'before.png' })],
          after: []
        }
      })
    )
    expect(wrapper.findAll('img')).toHaveLength(1)
    expect(wrapper.find('img').attributes('src')).toContain('before.png')
  })

  it('renders single image when only after side of compare has data', () => {
    const wrapper = mountComponent(
      makeResultItem({
        mediaType: 'image_compare',
        compareImages: {
          before: [],
          after: [makeResultItem({ filename: 'after.png' })]
        }
      })
    )
    expect(wrapper.findAll('img')).toHaveLength(1)
    expect(wrapper.find('img').attributes('src')).toContain('after.png')
  })

  it.for([
    { mediaType: 'audio', filename: 'sound.mp3' },
    { mediaType: 'text', filename: 'notes.txt' },
    { mediaType: '3d', filename: 'model.glb' }
  ])(
    'renders fallback icon for $mediaType media type',
    ({ mediaType, filename }) => {
      const wrapper = mountComponent(makeResultItem({ filename, mediaType }))
      const icon = wrapper.find('i')
      expect(icon.exists()).toBe(true)
    }
  )
})
