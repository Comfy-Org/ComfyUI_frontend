import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import OutputHistoryItem from '@/renderer/extensions/linearMode/OutputHistoryItem.vue'
import type { CompareImages } from '@/stores/queueStore'
import { ResultItemImpl } from '@/stores/queueStore'

function makeResultItem(
  filename: string,
  mediaType: string,
  compareImages?: CompareImages
): ResultItemImpl {
  return new ResultItemImpl({
    filename,
    subfolder: '',
    type: 'output',
    mediaType,
    nodeId: '1',
    compareImages
  })
}

function mountComponent(output: ResultItemImpl) {
  return mount(OutputHistoryItem, {
    props: { output }
  })
}

describe('OutputHistoryItem', () => {
  it('renders split 50/50 thumbnail for image_compare items', () => {
    const before = [makeResultItem('before.png', 'images')]
    const after = [makeResultItem('after.png', 'images')]
    const output = makeResultItem('', 'image_compare', {
      before,
      after
    })

    const wrapper = mountComponent(output)

    const images = wrapper.findAll('img')
    expect(images).toHaveLength(2)
    expect(images[0].attributes('src')).toContain('before.png')
    expect(images[1].attributes('src')).toContain('after.png')
  })

  it('renders image thumbnail for regular image items', () => {
    const output = makeResultItem('photo.png', 'images')

    const wrapper = mountComponent(output)

    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toContain('photo.png')
  })
})
