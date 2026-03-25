import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, watch } from 'vue'
import { createI18n } from 'vue-i18n'

import SearchInput from './SearchInput.vue'

vi.mock('@vueuse/core', () => ({
  watchDebounced: vi.fn((source, cb, opts) => {
    let timer: ReturnType<typeof setTimeout> | null = null
    return watch(source, (val: string) => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => cb(val), opts?.debounce ?? 300)
    })
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        clear: 'Clear',
        searchPlaceholder: 'Search...'
      }
    }
  }
})

describe('SearchInput', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  function mountComponent(props = {}) {
    return mount(SearchInput, {
      global: {
        plugins: [i18n],
        stubs: {
          ComboboxRoot: {
            template: '<div><slot /></div>'
          },
          ComboboxAnchor: {
            template: '<div @click="$emit(\'click\')"><slot /></div>',
            emits: ['click']
          },
          ComboboxInput: {
            template:
              '<input :placeholder="placeholder" :value="modelValue" :autofocus="autoFocus || undefined" @input="$emit(\'update:modelValue\', $event.target.value)" />',
            props: ['placeholder', 'modelValue', 'autoFocus']
          }
        }
      },
      props: {
        modelValue: '',
        ...props
      }
    })
  }

  describe('debounced search', () => {
    it('should debounce search input by 300ms', async () => {
      const wrapper = mountComponent()
      const input = wrapper.find('input')

      await input.setValue('test')

      expect(wrapper.emitted('search')).toBeFalsy()

      await vi.advanceTimersByTimeAsync(299)
      await nextTick()
      expect(wrapper.emitted('search')).toBeFalsy()

      await vi.advanceTimersByTimeAsync(1)
      await nextTick()

      expect(wrapper.emitted('search')).toEqual([['test']])
    })

    it('should reset debounce timer on each keystroke', async () => {
      const wrapper = mountComponent()
      const input = wrapper.find('input')

      await input.setValue('t')
      vi.advanceTimersByTime(200)
      await nextTick()

      await input.setValue('te')
      vi.advanceTimersByTime(200)
      await nextTick()

      await input.setValue('tes')
      await vi.advanceTimersByTimeAsync(200)
      await nextTick()

      expect(wrapper.emitted('search')).toBeFalsy()

      await vi.advanceTimersByTimeAsync(100)
      await nextTick()

      expect(wrapper.emitted('search')).toBeTruthy()
      expect(wrapper.emitted('search')?.[0]).toEqual(['tes'])
    })

    it('should only emit final value after rapid typing', async () => {
      const wrapper = mountComponent()
      const input = wrapper.find('input')

      const searchTerms = ['s', 'se', 'sea', 'sear', 'searc', 'search']
      for (const term of searchTerms) {
        await input.setValue(term)
        await vi.advanceTimersByTimeAsync(50)
      }
      await nextTick()

      expect(wrapper.emitted('search')).toBeFalsy()

      await vi.advanceTimersByTimeAsync(350)
      await nextTick()

      expect(wrapper.emitted('search')).toHaveLength(1)
      expect(wrapper.emitted('search')?.[0]).toEqual(['search'])
    })
  })

  describe('model sync', () => {
    it('should sync external model changes to internal state', async () => {
      const wrapper = mountComponent({ modelValue: 'initial' })
      const input = wrapper.find('input')

      expect(input.element.value).toBe('initial')

      await wrapper.setProps({ modelValue: 'external update' })
      await nextTick()

      expect(input.element.value).toBe('external update')
    })
  })

  describe('placeholder', () => {
    it('should use custom placeholder when provided', () => {
      const wrapper = mountComponent({ placeholder: 'Custom search...' })
      const input = wrapper.find('input')

      expect(input.attributes('placeholder')).toBe('Custom search...')
    })

    it('should use i18n placeholder when not provided', () => {
      const wrapper = mountComponent()
      const input = wrapper.find('input')

      expect(input.attributes('placeholder')).toBe('Search...')
    })
  })

  describe('autofocus', () => {
    it('should pass autofocus prop to ComboboxInput', () => {
      const wrapper = mountComponent({ autofocus: true })
      const input = wrapper.find('input')
      expect(input.attributes('autofocus')).toBeDefined()
    })

    it('should not autofocus by default', () => {
      const wrapper = mountComponent()
      const input = wrapper.find('input')
      expect(input.attributes('autofocus')).toBeUndefined()
    })
  })

  describe('focus method', () => {
    it('should expose focus method via ref', () => {
      const wrapper = mountComponent()
      expect(wrapper.vm.focus).toBeDefined()
    })
  })

  describe('clear button', () => {
    it('shows search icon when value is empty', () => {
      const wrapper = mountComponent({ modelValue: '' })
      expect(wrapper.find('button[aria-label="Clear"]').exists()).toBe(false)
    })

    it('shows clear button when value is not empty', () => {
      const wrapper = mountComponent({ modelValue: 'test' })
      expect(wrapper.find('button[aria-label="Clear"]').exists()).toBe(true)
    })

    it('clears value when clear button is clicked', async () => {
      const wrapper = mountComponent({ modelValue: 'test' })
      const clearButton = wrapper.find('button')
      await clearButton.trigger('click')
      expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([''])
    })
  })
})
