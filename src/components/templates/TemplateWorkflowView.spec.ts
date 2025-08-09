import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import TemplateWorkflowView from '@/components/templates/TemplateWorkflowView.vue'
import { TemplateInfo } from '@/types/workflowTemplateTypes'

vi.mock('primevue/dataview', () => ({
  default: {
    name: 'DataView',
    template: `
      <div class="p-dataview">
        <div class="dataview-header"><slot name="header"></slot></div>
        <div class="dataview-content">
          <slot name="grid" :items="value"></slot>
        </div>
      </div>
    `,
    props: ['value', 'layout', 'lazy', 'pt']
  }
}))

vi.mock('primevue/selectbutton', () => ({
  default: {
    name: 'SelectButton',
    template:
      '<div class="p-selectbutton"><slot name="option" :option="modelValue"></slot></div>',
    props: ['modelValue', 'options', 'allowEmpty']
  }
}))

vi.mock('@/components/templates/TemplateWorkflowCard.vue', () => ({
  default: {
    template: `
      <div 
        class="mock-template-card" 
        :data-name="template.name"
        :data-source-module="sourceModule"
        :data-category-title="categoryTitle"
        :data-loading="loading"
        @click="$emit('loadWorkflow', template.name)"
      ></div>
    `,
    props: ['sourceModule', 'categoryTitle', 'loading', 'template'],
    emits: ['loadWorkflow']
  }
}))

vi.mock('@/components/templates/TemplateWorkflowList.vue', () => ({
  default: {
    template: '<div class="mock-template-list"></div>',
    props: ['sourceModule', 'categoryTitle', 'loading', 'templates'],
    emits: ['loadWorkflow']
  }
}))

vi.mock('@/components/templates/TemplateSearchBar.vue', () => ({
  default: {
    template: '<div class="mock-search-bar"></div>',
    props: ['searchQuery', 'filteredCount'],
    emits: ['update:searchQuery', 'clearFilters']
  }
}))

vi.mock('@/components/templates/TemplateWorkflowCardSkeleton.vue', () => ({
  default: {
    template: '<div class="mock-skeleton"></div>'
  }
}))

vi.mock('@vueuse/core', () => ({
  useLocalStorage: () => 'grid'
}))

vi.mock('@/composables/useIntersectionObserver', () => ({
  useIntersectionObserver: vi.fn()
}))

vi.mock('@/composables/useLazyPagination', () => ({
  useLazyPagination: (items: any) => ({
    paginatedItems: items,
    isLoading: { value: false },
    hasMoreItems: { value: false },
    loadNextPage: vi.fn(),
    reset: vi.fn()
  })
}))

vi.mock('@/composables/useTemplateFiltering', () => ({
  useTemplateFiltering: (templates: any) => ({
    searchQuery: { value: '' },
    filteredTemplates: templates,
    filteredCount: { value: templates.value?.length || 0 }
  })
}))

describe('TemplateWorkflowView', () => {
  const createTemplate = (name: string): TemplateInfo => ({
    name,
    mediaType: 'image',
    mediaSubtype: 'png',
    thumbnailVariant: 'default',
    description: `Description for ${name}`
  })

  const mountView = (props = {}) => {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: {
        en: {
          templateWorkflows: {
            loadingMore: 'Loading more...'
          }
        }
      }
    })

    return mount(TemplateWorkflowView, {
      props: {
        title: 'Test Templates',
        sourceModule: 'default',
        categoryTitle: 'Test Category',
        templates: [
          createTemplate('template-1'),
          createTemplate('template-2'),
          createTemplate('template-3')
        ],
        loading: null,
        ...props
      },
      global: {
        plugins: [i18n]
      }
    })
  }

  it('renders template cards for each template', () => {
    const wrapper = mountView()
    const cards = wrapper.findAll('.mock-template-card')

    expect(cards.length).toBe(3)
    expect(cards[0].attributes('data-name')).toBe('template-1')
    expect(cards[1].attributes('data-name')).toBe('template-2')
    expect(cards[2].attributes('data-name')).toBe('template-3')
  })

  it('emits loadWorkflow event when clicked', async () => {
    const wrapper = mountView()
    const card = wrapper.find('.mock-template-card')

    await card.trigger('click')

    expect(wrapper.emitted()).toHaveProperty('loadWorkflow')
    // Check that the emitted event contains the template name
    const emitted = wrapper.emitted('loadWorkflow')
    expect(emitted).toBeTruthy()
    expect(emitted?.[0][0]).toBe('template-1')
  })

  it('passes correct props to template cards', () => {
    const wrapper = mountView({
      sourceModule: 'custom',
      categoryTitle: 'Custom Category'
    })

    const card = wrapper.find('.mock-template-card')
    expect(card.exists()).toBe(true)
    expect(card.attributes('data-source-module')).toBe('custom')
    expect(card.attributes('data-category-title')).toBe('Custom Category')
  })

  it('applies loading state correctly to cards', () => {
    const wrapper = mountView({
      loading: 'template-2'
    })

    const cards = wrapper.findAll('.mock-template-card')

    // Only the second card should have loading=true since loading="template-2"
    expect(cards[0].attributes('data-loading')).toBe('false')
    expect(cards[1].attributes('data-loading')).toBe('true')
    expect(cards[2].attributes('data-loading')).toBe('false')
  })
})
