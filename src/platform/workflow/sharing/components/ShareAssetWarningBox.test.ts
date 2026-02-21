import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import ShareAssetWarningBox from '@/platform/workflow/sharing/components/ShareAssetWarningBox.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      shareWorkflow: {
        createLinkDescription:
          'When you create a link for your workflow, you will share these assets along with your workflow',
        assetsLabel: 'Assets ({count})',
        modelsLabel: 'Models ({count})',
        acknowledgeCheckbox: 'I understand these assets...'
      }
    }
  }
})

describe('ShareAssetWarningBox', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createWrapper(props = {}) {
    return mount(ShareAssetWarningBox, {
      props: {
        assets: [
          { name: 'image.png', thumbnailUrl: 'https://example.com/a.jpg' }
        ],
        models: [{ name: 'model.safetensors', thumbnailUrl: null }],
        acknowledged: false,
        ...props
      },
      global: {
        plugins: [i18n]
      }
    })
  }

  it('renders warning text', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('you will share these assets')
  })

  it('renders asset and model collapsible sections', () => {
    const wrapper = createWrapper()

    expect(wrapper.text()).toContain('Assets (1)')
    expect(wrapper.text()).toContain('Models (1)')
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
      assets: [{ name: 'image.png', thumbnailUrl: null }],
      models: [{ name: 'model.safetensors', thumbnailUrl: null }]
    })

    const fallbackIcons = wrapper
      .findAll('i')
      .filter((icon) => icon.classes().includes('icon-[lucide--image]'))

    expect(fallbackIcons).toHaveLength(2)
  })

  it('hides assets section when no assets provided', () => {
    const wrapper = createWrapper({ assets: [] })

    expect(wrapper.text()).not.toContain('Assets')
  })

  it('hides models section when no models provided', () => {
    const wrapper = createWrapper({ models: [] })

    expect(wrapper.text()).not.toContain('Models')
  })
})
