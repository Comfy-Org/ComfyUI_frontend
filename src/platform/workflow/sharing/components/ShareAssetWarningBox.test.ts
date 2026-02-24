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
          'When you create a link for your workflow, you will share these media items along with your workflow',
        mediaLabel: 'Media ({count})',
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
    expect(wrapper.text()).toContain('you will share these media items')
  })

  it('renders media and model collapsible sections', () => {
    const wrapper = createWrapper()

    expect(wrapper.text()).toContain('Media (1)')
    expect(wrapper.text()).toContain('Models (1)')
  })

  it('expands only one accordion section at a time', async () => {
    const wrapper = createWrapper()

    const mediaHeader = wrapper.get('[data-testid="section-header-media"]')
    const modelsHeader = wrapper.get('[data-testid="section-header-models"]')
    const mediaChevron = mediaHeader.get('i')
    const modelsChevron = modelsHeader.get('i')
    const mediaContent = wrapper.get('[data-testid="section-content-media"]')
    const modelsContent = wrapper.get('[data-testid="section-content-models"]')

    expect(mediaContent.attributes('style')).toBeUndefined()
    expect(modelsContent.attributes('style')).toContain('display: none;')
    expect(mediaHeader.attributes('aria-expanded')).toBe('true')
    expect(modelsHeader.attributes('aria-expanded')).toBe('false')
    expect(mediaHeader.attributes('aria-controls')).toBe(
      'section-content-media'
    )
    expect(modelsHeader.attributes('aria-controls')).toBe(
      'section-content-models'
    )
    expect(mediaChevron.classes()).toContain('rotate-180')
    expect(modelsChevron.classes()).not.toContain('rotate-180')

    await modelsHeader.trigger('click')
    await nextTick()

    expect(mediaContent.attributes('style')).toContain('display: none;')
    expect(modelsContent.attributes('style')).toBeUndefined()
    expect(mediaHeader.attributes('aria-expanded')).toBe('false')
    expect(modelsHeader.attributes('aria-expanded')).toBe('true')
    expect(mediaChevron.classes()).not.toContain('rotate-180')
    expect(modelsChevron.classes()).toContain('rotate-180')

    await mediaHeader.trigger('click')
    await nextTick()

    expect(mediaContent.attributes('style')).toBeUndefined()
    expect(modelsContent.attributes('style')).toContain('display: none;')
    expect(mediaHeader.attributes('aria-expanded')).toBe('true')
    expect(modelsHeader.attributes('aria-expanded')).toBe('false')
    expect(mediaChevron.classes()).toContain('rotate-180')
    expect(modelsChevron.classes()).not.toContain('rotate-180')

    await mediaHeader.trigger('click')
    await nextTick()

    expect(mediaContent.attributes('style')).toBeUndefined()
    expect(modelsContent.attributes('style')).toContain('display: none;')
    expect(mediaHeader.attributes('aria-expanded')).toBe('true')
    expect(modelsHeader.attributes('aria-expanded')).toBe('false')
  })

  it('defaults to media section when both sections are available', () => {
    const wrapper = createWrapper()

    const mediaContent = wrapper.get('[data-testid="section-content-media"]')
    const modelsContent = wrapper.get('[data-testid="section-content-models"]')

    expect(mediaContent.attributes('style')).toBeUndefined()
    expect(modelsContent.attributes('style')).toContain('display: none;')
  })

  it('defaults to models section when media is unavailable', () => {
    const wrapper = createWrapper({ assets: [] })

    expect(wrapper.text()).toContain('Models (1)')
    const modelsHeader = wrapper.get('[data-testid="section-header-models"]')
    const modelsContent = wrapper.get('[data-testid="section-content-models"]')

    expect(modelsHeader.attributes('aria-expanded')).toBe('true')
    expect(modelsContent.attributes('style')).toBeUndefined()
  })

  it('keeps media section expanded when models are unavailable', async () => {
    const wrapper = createWrapper({ models: [] })

    const mediaHeader = wrapper.get('[data-testid="section-header-media"]')
    const mediaContent = wrapper.get('[data-testid="section-content-media"]')
    const mediaChevron = mediaHeader.get('i')

    expect(mediaHeader.attributes('aria-expanded')).toBe('true')
    expect(mediaContent.attributes('style')).toBeUndefined()
    expect(mediaChevron.classes()).toContain('rotate-180')

    await mediaHeader.trigger('click')
    await nextTick()

    expect(mediaHeader.attributes('aria-expanded')).toBe('true')
    expect(mediaContent.attributes('style')).toBeUndefined()
    expect(mediaChevron.classes()).toContain('rotate-180')
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

    expect(wrapper.text()).not.toContain('Media')
  })

  it('hides models section when no models provided', () => {
    const wrapper = createWrapper({ models: [] })

    expect(wrapper.text()).not.toContain('Models')
  })
})
