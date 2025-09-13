import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import TemplateWorkflowCard from '@/components/templates/TemplateWorkflowCard.vue'
import { TemplateInfo } from '@/types/workflowTemplateTypes'

vi.mock('@/components/templates/thumbnails/AudioThumbnail.vue', () => ({
  default: {
    name: 'AudioThumbnail',
    template: '<div class="mock-audio-thumbnail" :data-src="src"></div>',
    props: ['src']
  }
}))

vi.mock('@/components/templates/thumbnails/CompareSliderThumbnail.vue', () => ({
  default: {
    name: 'CompareSliderThumbnail',
    template:
      '<div class="mock-compare-slider" :data-base="baseImageSrc" :data-overlay="overlayImageSrc"></div>',
    props: ['baseImageSrc', 'overlayImageSrc', 'alt', 'isHovered']
  }
}))

vi.mock('@/components/templates/thumbnails/DefaultThumbnail.vue', () => ({
  default: {
    name: 'DefaultThumbnail',
    template: '<div class="mock-default-thumbnail" :data-src="src"></div>',
    props: ['src', 'alt', 'isHovered', 'isVideo', 'hoverZoom']
  }
}))

vi.mock('@/components/templates/thumbnails/HoverDissolveThumbnail.vue', () => ({
  default: {
    name: 'HoverDissolveThumbnail',
    template:
      '<div class="mock-hover-dissolve" :data-base="baseImageSrc" :data-overlay="overlayImageSrc"></div>',
    props: ['baseImageSrc', 'overlayImageSrc', 'alt', 'isHovered']
  }
}))

vi.mock('@vueuse/core', () => ({
  useElementHover: () => ref(false)
}))

vi.mock('@/scripts/api', () => ({
  api: {
    fileURL: (path: string) => `/fileURL${path}`,
    apiURL: (path: string) => `/apiURL${path}`,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
}))

vi.mock('@/scripts/app', () => ({
  app: {
    loadGraphData: vi.fn()
  }
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({
    closeDialog: vi.fn()
  })
}))

vi.mock('@/stores/workflowTemplatesStore', () => ({
  useWorkflowTemplatesStore: () => ({
    isLoaded: true,
    loadWorkflowTemplates: vi.fn().mockResolvedValue(true),
    groupedTemplates: []
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, fallback: string) => fallback || key
  })
}))

vi.mock('@/composables/useTemplateWorkflows', () => ({
  useTemplateWorkflows: () => ({
    getTemplateThumbnailUrl: (
      template: TemplateInfo,
      sourceModule: string,
      index = ''
    ) => {
      const basePath =
        sourceModule === 'default'
          ? `/fileURL/templates/${template.name}`
          : `/apiURL/workflow_templates/${sourceModule}/${template.name}`
      const indexSuffix = sourceModule === 'default' && index ? `-${index}` : ''
      return `${basePath}${indexSuffix}.${template.mediaSubtype}`
    },
    getTemplateTitle: (template: TemplateInfo, sourceModule: string) => {
      const fallback =
        template.title ?? template.name ?? `${sourceModule} Template`
      return sourceModule === 'default'
        ? template.localizedTitle ?? fallback
        : fallback
    },
    getTemplateDescription: (template: TemplateInfo, sourceModule: string) => {
      return sourceModule === 'default'
        ? template.localizedDescription ?? ''
        : template.description?.replace(/[-_]/g, ' ').trim() ?? ''
    },
    loadWorkflowTemplate: vi.fn()
  })
}))

describe('TemplateWorkflowCard', () => {
  const createTemplate = (overrides = {}): TemplateInfo => ({
    name: 'test-template',
    mediaType: 'image',
    mediaSubtype: 'png',
    thumbnailVariant: 'default',
    description: 'Test description',
    ...overrides
  })

  const mountCard = (props = {}) => {
    return mount(TemplateWorkflowCard, {
      props: {
        sourceModule: 'default',
        categoryTitle: 'Test Category',
        loading: false,
        template: createTemplate(),
        ...props
      },
      global: {
        stubs: {
          Card: {
            template:
              '<div class="card" @click="$emit(\'click\')"><slot name="header" /><slot name="content" /></div>',
            props: ['dataTestid', 'pt']
          },
          ProgressSpinner: {
            template: '<div class="progress-spinner"></div>'
          }
        }
      }
    })
  }

  it('emits loadWorkflow event when clicked', async () => {
    const wrapper = mountCard({
      template: createTemplate({ name: 'test-workflow' })
    })
    await wrapper.find('.card').trigger('click')
    expect(wrapper.emitted('loadWorkflow')).toBeTruthy()
    expect(wrapper.emitted('loadWorkflow')?.[0]).toEqual(['test-workflow'])
  })

  it('shows loading spinner when loading is true', () => {
    const wrapper = mountCard({ loading: true })
    expect(wrapper.find('.progress-spinner').exists()).toBe(true)
  })

  it('renders audio thumbnail for audio media type', () => {
    const wrapper = mountCard({
      template: createTemplate({ mediaType: 'audio' })
    })
    expect(wrapper.find('.mock-audio-thumbnail').exists()).toBe(true)
  })

  it('renders compare slider thumbnail for compareSlider variant', () => {
    const wrapper = mountCard({
      template: createTemplate({ thumbnailVariant: 'compareSlider' })
    })
    expect(wrapper.find('.mock-compare-slider').exists()).toBe(true)
  })

  it('renders hover dissolve thumbnail for hoverDissolve variant', () => {
    const wrapper = mountCard({
      template: createTemplate({ thumbnailVariant: 'hoverDissolve' })
    })
    expect(wrapper.find('.mock-hover-dissolve').exists()).toBe(true)
  })

  it('renders default thumbnail by default', () => {
    const wrapper = mountCard()
    expect(wrapper.find('.mock-default-thumbnail').exists()).toBe(true)
  })

  it('passes correct props to default thumbnail for video', () => {
    const wrapper = mountCard({
      template: createTemplate({ mediaType: 'video' })
    })
    const thumbnail = wrapper.find('.mock-default-thumbnail')
    expect(thumbnail.exists()).toBe(true)
  })

  it('uses zoomHover scale when variant is zoomHover', () => {
    const wrapper = mountCard({
      template: createTemplate({ thumbnailVariant: 'zoomHover' })
    })
    expect(wrapper.find('.mock-default-thumbnail').exists()).toBe(true)
  })

  it('displays localized title for default source module', () => {
    const wrapper = mountCard({
      sourceModule: 'default',
      template: createTemplate({ localizedTitle: 'My Localized Title' })
    })
    expect(wrapper.text()).toContain('My Localized Title')
  })

  it('displays template name as title for non-default source modules', () => {
    const wrapper = mountCard({
      sourceModule: 'custom',
      template: createTemplate({ name: 'custom-template' })
    })
    expect(wrapper.text()).toContain('custom-template')
  })

  it('displays localized description for default source module', () => {
    const wrapper = mountCard({
      sourceModule: 'default',
      template: createTemplate({
        localizedDescription: 'My Localized Description'
      })
    })
    expect(wrapper.text()).toContain('My Localized Description')
  })

  it('processes description for non-default source modules', () => {
    const wrapper = mountCard({
      sourceModule: 'custom',
      template: createTemplate({ description: 'custom_module-description' })
    })
    expect(wrapper.text()).toContain('custom module description')
  })

  it('generates correct thumbnail URLs for default source module', () => {
    const wrapper = mountCard({
      sourceModule: 'default',
      template: createTemplate({
        name: 'my-template',
        mediaSubtype: 'jpg'
      })
    })
    const vm = wrapper.vm as any
    expect(vm.baseThumbnailSrc).toBe('/fileURL/templates/my-template-1.jpg')
    expect(vm.overlayThumbnailSrc).toBe('/fileURL/templates/my-template-2.jpg')
  })

  it('generates correct thumbnail URLs for custom source module', () => {
    const wrapper = mountCard({
      sourceModule: 'custom-module',
      template: createTemplate({
        name: 'my-template',
        mediaSubtype: 'png'
      })
    })
    const vm = wrapper.vm as any
    expect(vm.baseThumbnailSrc).toBe(
      '/apiURL/workflow_templates/custom-module/my-template.png'
    )
    expect(vm.overlayThumbnailSrc).toBe(
      '/apiURL/workflow_templates/custom-module/my-template.png'
    )
  })
})
