import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type { ComponentProps } from 'vue-component-type-helpers'

import ShareAssetWarningBox from '@/platform/workflow/sharing/components/ShareAssetWarningBox.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      shareWorkflow: {
        privateAssetsDescription:
          'Your workflow contains private models and/or media files',
        mediaLabel: '{count} Media File | {count} Media Files',
        modelsLabel: '{count} Model | {count} Models',
        acknowledgeCheckbox: 'I understand these assets...'
      }
    }
  }
})

describe(ShareAssetWarningBox, () => {
  function createWrapper(
    props: Partial<ComponentProps<typeof ShareAssetWarningBox>> = {}
  ) {
    return mount(ShareAssetWarningBox, {
      props: {
        items: [
          {
            id: 'asset-image',
            name: 'image.png',
            storage_url: '',
            preview_url: 'https://example.com/a.jpg',
            model: false,
            public: false,
            in_library: false
          },
          {
            id: 'model-default',
            name: 'model.safetensors',
            storage_url: '',
            preview_url: '',
            model: true,
            public: false,
            in_library: false
          }
        ],
        acknowledged: false,
        ...props
      },
      global: {
        plugins: [i18n],
        stubs: {
          BaseTooltip: { template: '<slot />' }
        }
      }
    })
  }

  it('renders warning text', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain(
      'Your workflow contains private models and/or media files'
    )
  })

  it('renders media and model collapsible sections', () => {
    const wrapper = createWrapper()

    expect(wrapper.text()).toContain('1 Media File')
    expect(wrapper.text()).toContain('1 Model')
  })

  it('keeps at most one accordion section open at a time', async () => {
    const wrapper = createWrapper()

    const mediaHeader = wrapper.get('[data-testid="section-header-media"]')
    const modelsHeader = wrapper.get('[data-testid="section-header-models"]')
    const mediaChevron = mediaHeader.get('i')
    const modelsChevron = modelsHeader.get('i')

    expect(mediaHeader.attributes('aria-expanded')).toBe('true')
    expect(modelsHeader.attributes('aria-expanded')).toBe('false')
    expect(mediaHeader.attributes('aria-controls')).toBe(
      'section-content-media'
    )
    expect(modelsHeader.attributes('aria-controls')).toBe(
      'section-content-models'
    )
    expect(mediaChevron.classes()).toContain('rotate-90')
    expect(modelsChevron.classes()).not.toContain('rotate-90')

    await modelsHeader.trigger('click')
    await nextTick()

    expect(mediaHeader.attributes('aria-expanded')).toBe('false')
    expect(modelsHeader.attributes('aria-expanded')).toBe('true')
    expect(mediaChevron.classes()).not.toContain('rotate-90')
    expect(modelsChevron.classes()).toContain('rotate-90')

    await mediaHeader.trigger('click')
    await nextTick()

    expect(mediaHeader.attributes('aria-expanded')).toBe('true')
    expect(modelsHeader.attributes('aria-expanded')).toBe('false')
    expect(mediaChevron.classes()).toContain('rotate-90')
    expect(modelsChevron.classes()).not.toContain('rotate-90')

    await mediaHeader.trigger('click')
    await nextTick()

    expect(mediaHeader.attributes('aria-expanded')).toBe('false')
    expect(modelsHeader.attributes('aria-expanded')).toBe('false')
  })

  it('defaults to media section when both sections are available', () => {
    const wrapper = createWrapper()

    const mediaHeader = wrapper.get('[data-testid="section-header-media"]')
    const modelsHeader = wrapper.get('[data-testid="section-header-models"]')

    expect(mediaHeader.attributes('aria-expanded')).toBe('true')
    expect(modelsHeader.attributes('aria-expanded')).toBe('false')
  })

  it('defaults to models section when media is unavailable', () => {
    const wrapper = createWrapper({
      items: [
        {
          id: 'model-default',
          name: 'model.safetensors',
          storage_url: '',
          preview_url: '',
          model: true,
          public: false,
          in_library: false
        }
      ]
    })

    expect(wrapper.text()).toContain('1 Model')
    const modelsHeader = wrapper.get('[data-testid="section-header-models"]')

    expect(modelsHeader.attributes('aria-expanded')).toBe('true')
  })

  it('allows collapsing the only expanded section when models are unavailable', async () => {
    const wrapper = createWrapper({
      items: [
        {
          id: 'asset-image',
          name: 'image.png',
          storage_url: '',
          preview_url: 'https://example.com/a.jpg',
          model: false,
          public: false,
          in_library: false
        }
      ]
    })

    const mediaHeader = wrapper.get('[data-testid="section-header-media"]')
    const mediaChevron = mediaHeader.get('i')

    expect(mediaHeader.attributes('aria-expanded')).toBe('true')
    expect(mediaChevron.classes()).toContain('rotate-90')

    await mediaHeader.trigger('click')
    await nextTick()

    expect(mediaHeader.attributes('aria-expanded')).toBe('false')
    expect(mediaChevron.classes()).not.toContain('rotate-90')
  })

  it('emits acknowledged update when checkbox is toggled', async () => {
    const wrapper = createWrapper()

    const checkbox = wrapper.find('input[type="checkbox"]')
    await checkbox.setValue(true)
    await nextTick()

    expect(wrapper.emitted('update:acknowledged')).toBeTruthy()
    expect(wrapper.emitted('update:acknowledged')![0]).toEqual([true])
  })

  it('displays asset names in the assets section', () => {
    const wrapper = createWrapper()

    expect(wrapper.text()).toContain('image.png')
  })

  it('renders thumbnail previews for assets when URLs are available', () => {
    const wrapper = createWrapper()

    const images = wrapper.findAll('img')
    expect(images).toHaveLength(1)
    expect(images[0].attributes('src')).toBe('https://example.com/a.jpg')
    expect(images[0].attributes('alt')).toBe('image.png')
  })

  it('renders fallback icon when thumbnail is missing', () => {
    const wrapper = createWrapper({
      items: [
        {
          id: 'asset-image',
          name: 'image.png',
          storage_url: '',
          preview_url: '',
          model: false,
          public: false,
          in_library: false
        },
        {
          id: 'model-default',
          name: 'model.safetensors',
          storage_url: '',
          preview_url: '',
          model: true,
          public: false,
          in_library: false
        }
      ]
    })

    const fallbackIcons = wrapper
      .findAll('i')
      .filter((icon) => icon.classes().includes('icon-[lucide--image]'))

    expect(fallbackIcons).toHaveLength(1)
  })

  it('hides assets section when no assets provided', () => {
    const wrapper = createWrapper({
      items: [
        {
          id: 'model-default',
          name: 'model.safetensors',
          storage_url: '',
          preview_url: '',
          model: true,
          public: false,
          in_library: false
        }
      ]
    })

    expect(wrapper.text()).not.toContain('Media File')
  })

  it('hides models section when no models provided', () => {
    const wrapper = createWrapper({
      items: [
        {
          id: 'asset-image',
          name: 'image.png',
          storage_url: '',
          preview_url: '',
          model: false,
          public: false,
          in_library: false
        }
      ]
    })

    expect(wrapper.text()).not.toContain('Model')
  })
})
