import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import ModelBrowserStates from './ModelBrowserStates.vue'

const i18nMock = {
  global: {
    mocks: {
      $t: (key: string) => key
    }
  }
}

describe('ModelBrowserStates', () => {
  it('should render loading state', () => {
    const wrapper = mount(ModelBrowserStates, {
      ...i18nMock,
      props: {
        isLoading: true,
        error: null,
        isEmpty: false,
        emptyMessage: '',
        showClearFilters: false
      }
    })

    expect(wrapper.find('.animate-spin').exists()).toBe(true)
    expect(wrapper.text()).toContain('modelBrowser.loading')
  })

  it('should render error state with retry button', async () => {
    const wrapper = mount(ModelBrowserStates, {
      ...i18nMock,
      props: {
        isLoading: false,
        error: new Error('Test error'),
        isEmpty: false,
        emptyMessage: '',
        showClearFilters: false
      }
    })

    expect(wrapper.find('.icon-\\[lucide--alert-circle\\]').exists()).toBe(true)
    expect(wrapper.text()).toContain('modelBrowser.errorLoading')
    expect(wrapper.text()).toContain('modelBrowser.retry')

    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('should render empty state with custom message', () => {
    const wrapper = mount(ModelBrowserStates, {
      ...i18nMock,
      props: {
        isLoading: false,
        error: null,
        isEmpty: true,
        emptyMessage: 'No models available',
        showClearFilters: false
      }
    })

    expect(wrapper.find('.icon-\\[lucide--inbox\\]').exists()).toBe(true)
    expect(wrapper.text()).toContain('No models available')
  })

  it('should show clear filters button when showClearFilters is true', async () => {
    const wrapper = mount(ModelBrowserStates, {
      ...i18nMock,
      props: {
        isLoading: false,
        error: null,
        isEmpty: true,
        emptyMessage: 'No results',
        showClearFilters: true
      }
    })

    expect(wrapper.text()).toContain('modelBrowser.clearFilters')

    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('clear-filters')).toHaveLength(1)
  })

  it('should hide clear filters button when showClearFilters is false', () => {
    const wrapper = mount(ModelBrowserStates, {
      ...i18nMock,
      props: {
        isLoading: false,
        error: null,
        isEmpty: true,
        emptyMessage: 'No results',
        showClearFilters: false
      }
    })

    expect(wrapper.findAll('button')).toHaveLength(0)
  })

  it('should render slot content when not loading, error, or empty', () => {
    const wrapper = mount(ModelBrowserStates, {
      ...i18nMock,
      props: {
        isLoading: false,
        error: null,
        isEmpty: false,
        emptyMessage: '',
        showClearFilters: false
      },
      slots: {
        default: '<div class="test-content">Model Grid</div>'
      }
    })

    expect(wrapper.find('.test-content').exists()).toBe(true)
    expect(wrapper.text()).toContain('Model Grid')
  })

  it('should prioritize loading over error state', () => {
    const wrapper = mount(ModelBrowserStates, {
      ...i18nMock,
      props: {
        isLoading: true,
        error: new Error('Test error'),
        isEmpty: false,
        emptyMessage: '',
        showClearFilters: false
      }
    })

    expect(wrapper.find('.animate-spin').exists()).toBe(true)
    expect(wrapper.find('.icon-\\[lucide--alert-circle\\]').exists()).toBe(
      false
    )
  })

  it('should prioritize error over empty state', () => {
    const wrapper = mount(ModelBrowserStates, {
      ...i18nMock,
      props: {
        isLoading: false,
        error: new Error('Test error'),
        isEmpty: true,
        emptyMessage: 'Empty',
        showClearFilters: false
      }
    })

    expect(wrapper.find('.icon-\\[lucide--alert-circle\\]').exists()).toBe(true)
    expect(wrapper.find('.icon-\\[lucide--inbox\\]').exists()).toBe(false)
  })
})
