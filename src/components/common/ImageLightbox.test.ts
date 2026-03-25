import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import ImageLightbox from './ImageLightbox.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

function findCloseButton() {
  const el = document.body.querySelector('[aria-label="g.close"]')
  return el ? new DOMWrapper(el) : null
}

describe(ImageLightbox, () => {
  let wrapper: VueWrapper

  afterEach(() => {
    wrapper.unmount()
  })

  function mountComponent(props: { src: string; alt?: string }, open = true) {
    wrapper = mount(ImageLightbox, {
      global: { plugins: [i18n] },
      props: { ...props, modelValue: open },
      attachTo: document.body
    })
    return wrapper
  }

  it('renders the image with correct src and alt when open', async () => {
    mountComponent({ src: '/test.png', alt: 'Test image' })
    await flushPromises()
    const img = document.body.querySelector('img')
    expect(img).toBeTruthy()
    expect(img?.getAttribute('src')).toBe('/test.png')
    expect(img?.getAttribute('alt')).toBe('Test image')
  })

  it('does not render dialog content when closed', async () => {
    mountComponent({ src: '/test.png' }, false)
    await flushPromises()
    expect(document.body.querySelector('img')).toBeNull()
  })

  it('emits update:modelValue false when close button is clicked', async () => {
    mountComponent({ src: '/test.png' })
    await flushPromises()
    const closeButton = findCloseButton()
    expect(closeButton).toBeTruthy()
    await closeButton!.trigger('click')
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
  })
})
