import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import TagInputWithAutocomplete from './TagInputWithAutocomplete.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { removeTag: 'Remove tag' } } }
})

describe('TagInputWithAutocomplete', () => {
  let wrapper: ReturnType<typeof mount>

  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    wrapper?.unmount()
  })

  function createWrapper(props = {}) {
    return mount(TagInputWithAutocomplete, {
      props: {
        modelValue: [],
        ...props
      },
      global: {
        plugins: [i18n]
      },
      attachTo: document.body
    })
  }

  it('renders with empty tags', () => {
    wrapper = createWrapper({ modelValue: [] })
    expect(wrapper.find('[data-testid="input-tags"]').exists()).toBe(true)
    expect(wrapper.find('input').exists()).toBe(true)
  })

  it('renders existing tags as chips', () => {
    wrapper = createWrapper({ modelValue: ['Image', 'Video'] })
    expect(wrapper.text()).toContain('Image')
    expect(wrapper.text()).toContain('Video')
  })

  it('emits update:modelValue when adding custom tag via Enter', async () => {
    wrapper = createWrapper({ modelValue: [] })
    const input = wrapper.find('input')
    await input.setValue('CustomTag')
    await input.trigger('keydown.enter')
    await nextTick()

    expect(wrapper.emitted('update:modelValue')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')![0][0]).toEqual(['CustomTag'])
  })

  it('adds first filtered suggestion when Enter pressed with matches', async () => {
    wrapper = createWrapper({ modelValue: [] })
    const input = wrapper.find('input')
    await input.setValue('Image')
    await nextTick()
    await input.trigger('keydown.enter')
    await nextTick()

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeDefined()
    expect(emitted![0][0]).toContain('Image')
  })

  it('excludes already-selected tags from suggestions', async () => {
    wrapper = createWrapper({ modelValue: ['Image'] })
    const input = wrapper.find('input')
    await input.setValue('Image')
    await nextTick()

    const suggestionItems = document.querySelectorAll(
      '[data-testid="suggestion-item"]'
    )
    const suggestionTexts = Array.from(suggestionItems).map((el) =>
      el.textContent?.trim()
    )
    expect(suggestionTexts).not.toContain('Image')
  })

  it('filters suggestions by input (case-insensitive)', async () => {
    wrapper = createWrapper({ modelValue: [] })
    const input = wrapper.find('input')
    await input.setValue('vid')
    await nextTick()

    const suggestionItems = document.querySelectorAll(
      '[data-testid="suggestion-item"]'
    )
    const suggestionTexts = Array.from(suggestionItems).map((el) =>
      el.textContent?.trim()
    )
    expect(suggestionTexts).toContain('Video')
  })

  it('selects suggestion via arrow down then Enter', async () => {
    wrapper = createWrapper({ modelValue: [] })
    const input = wrapper.find('input')
    await input.setValue('Image')
    await nextTick()

    const suggestionItems = document.querySelectorAll(
      '[data-testid="suggestion-item"]'
    )
    expect(suggestionItems.length).toBeGreaterThan(0)

    await input.trigger('keydown.down')
    await input.trigger('keydown.down')
    await input.trigger('keydown.enter')
    await nextTick()

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeDefined()
    expect(emitted![0][0]).toContain(
      (suggestionItems[1] as HTMLElement).textContent?.trim()
    )
  })
})
