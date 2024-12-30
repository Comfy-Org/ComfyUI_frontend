// @ts-strict-ignore
// Disabled because of https://github.com/Comfy-Org/ComfyUI_frontend/issues/1184
import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Galleria from 'primevue/galleria'
import { describe, expect, it } from 'vitest'

import ComfyImage from '@/components/common/ComfyImage.vue'
import { ResultItemImpl } from '@/stores/queueStore'

import ResultGallery from '../ResultGallery.vue'

type ResultGalleryProps = typeof ResultGallery.__props

describe('ResultGallery', () => {
  let mockResultItem: ResultItemImpl

  beforeEach(() => {
    mockResultItem = new ResultItemImpl({
      filename: 'test.jpg',
      type: 'images',
      nodeId: 1,
      mediaType: 'images'
    })
  })

  const mountResultGallery = (props: ResultGalleryProps, options = {}) => {
    return mount(ResultGallery, {
      global: {
        plugins: [PrimeVue],
        components: { Galleria, ComfyImage }
      },
      props,
      ...options
    })
  }

  const clickElement = async (element: Element) => {
    element.dispatchEvent(new MouseEvent('mousedown'))
    element.dispatchEvent(new MouseEvent('mouseup'))
  }

  it('is dismissed when overlay mask is clicked', async () => {
    const wrapper = mountResultGallery({
      activeIndex: 0,
      allGalleryItems: [mockResultItem]
    })
    wrapper.vm.galleryVisible = true
    await wrapper.vm.$nextTick()
    expect(wrapper.findComponent(Galleria).exists()).toBe(true)
    expect(wrapper.vm.galleryVisible).toBe(true)

    // Since Galleria uses teleport, we need to query the mask in the global document
    const mask = document.querySelector('[data-mask]')
    expect(mask).not.toBeNull()

    // Click the overlay mask to dismiss the gallery
    await clickElement(mask)
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.galleryVisible).toBe(false)
  })

  it('is not dismissed when gallery is clicked', async () => {
    const wrapper = mountResultGallery({
      activeIndex: 0,
      allGalleryItems: [mockResultItem]
    })
    wrapper.vm.galleryVisible = true
    await wrapper.vm.$nextTick()
    expect(wrapper.findComponent(Galleria).exists()).toBe(true)
    expect(wrapper.vm.galleryVisible).toBe(true)

    // Since Galleria uses teleport, we need to query the mask in the global document
    const gallery = document.querySelector('.p-galleria-content')
    expect(gallery).not.toBeNull()

    // The gallery should not be dismissed when the gallery itself is clicked
    await clickElement(gallery)
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.galleryVisible).toBe(true)
  })
})
