import { render, screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { ResolvedTemplateModelAvailability } from '@/platform/workflow/templates/utils/templateModelAvailability'

const fixtures = vi.hoisted(() => {
  const activeModel = {
    name: 'active-model.safetensors',
    directory: 'checkpoints',
    url: 'https://example.com/active-model.safetensors'
  }
  const bypassedModel = {
    name: 'bypassed-model.safetensors',
    directory: 'loras',
    url: 'https://example.com/bypassed-model.safetensors'
  }
  const template = {
    name: 'starter-detail',
    title: 'Starter Detail',
    description: 'Inspect this workflow before opening it.',
    mediaType: 'image',
    mediaSubtype: 'webp',
    sourceModule: 'default'
  }
  const prepared = {
    id: template.name,
    sourceModule: 'default',
    workflowName: template.title,
    workflow: {
      nodes: [
        {
          id: 1,
          type: 'CheckpointLoaderSimple',
          title: 'Active loader',
          properties: { models: [activeModel] },
          widgets_values: [activeModel.name]
        },
        {
          id: 2,
          type: 'LoraLoaderModelOnly',
          title: 'Bypassed loader',
          mode: 4,
          properties: { models: [bypassedModel] },
          widgets_values: [bypassedModel.name]
        }
      ],
      links: []
    }
  }

  return { activeModel, bypassedModel, prepared, template }
})

const runtime = vi.hoisted(() => ({ isCloud: false, isDesktop: true }))
const mocks = vi.hoisted(() => ({
  filterTemplatesByCategory: vi.fn(() => [fixtures.template]),
  getTemplateDescription: vi.fn(
    (template: { description: string }) => template.description
  ),
  getTemplateThumbnailUrl: vi.fn(() => '/thumbnail.webp'),
  getTemplateTitle: vi.fn((template: { title: string }) => template.title),
  loadTemplates: vi.fn(async () => true),
  loadWorkflowTemplate: vi.fn(async () => true),
  onClose: vi.fn(),
  openPreparedWorkflowTemplate: vi.fn(async () => true),
  prepareWorkflowTemplateForOpen: vi.fn(async () => fixtures.prepared),
  resolveAvailability: vi.fn<
    () => Promise<ResolvedTemplateModelAvailability[]>
  >(async () => [{ model: fixtures.activeModel, status: 'missing' }]),
  resolveTemplateModelMetadata: vi.fn(async () => ({
    status: 'completed' as const,
    entries: [
      {
        model: fixtures.activeModel,
        fileSize: 1024,
        resolution: 'resolved' as const
      }
    ]
  })),
  trackTemplateLibraryClosed: vi.fn()
}))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return runtime.isCloud
  },
  get isDesktop() {
    return runtime.isDesktop
  }
}))

vi.mock(
  '@/platform/workflow/templates/composables/useTemplateWorkflows',
  () => ({
    useTemplateWorkflows: () => ({
      getTemplateDescription: mocks.getTemplateDescription,
      getTemplateThumbnailUrl: mocks.getTemplateThumbnailUrl,
      getTemplateTitle: mocks.getTemplateTitle,
      loadTemplates: mocks.loadTemplates,
      loadWorkflowTemplate: mocks.loadWorkflowTemplate,
      openPreparedWorkflowTemplate: mocks.openPreparedWorkflowTemplate,
      prepareWorkflowTemplateForOpen: mocks.prepareWorkflowTemplateForOpen
    })
  })
)

vi.mock(
  '@/platform/workflow/templates/composables/useTemplateModelAvailability',
  () => ({
    useTemplateModelAvailability: () => ({
      resolveAvailability: mocks.resolveAvailability
    })
  })
)

vi.mock(
  '@/platform/workflow/templates/utils/templateModelMetadata',
  async (importOriginal) => ({
    ...(await importOriginal()),
    resolveTemplateModelMetadata: mocks.resolveTemplateModelMetadata
  })
)

vi.mock(
  '@/platform/workflow/templates/repositories/workflowTemplatesStore',
  () => ({
    useWorkflowTemplatesStore: () => ({
      enhancedTemplates: [fixtures.template],
      filterTemplatesByCategory: mocks.filterTemplatesByCategory,
      getLogoUrl: vi.fn(),
      loadWorkflowTemplates: vi.fn(async () => true),
      navGroupedTemplates: [
        { id: 'all', label: 'All Templates' },
        { id: 'popular', label: 'Popular' }
      ]
    })
  })
)

vi.mock('@/composables/useTemplateFiltering', () => ({
  useTemplateFiltering: (templates: {
    value: (typeof fixtures.template)[]
  }) => {
    const searchQuery = ref('')
    const selectedModels = ref<string[]>([])
    const selectedUseCases = ref<string[]>([])
    const selectedRunsOn = ref<string[]>([])
    const sortSelection = ref('default')

    return {
      searchQuery,
      selectedModels,
      selectedUseCases,
      selectedRunsOn,
      sortSelection,
      hasActiveQuery: computed(() => false),
      activeModels: computed(() => selectedModels.value),
      activeUseCases: computed(() => selectedUseCases.value),
      filteredTemplates: templates,
      availableModels: computed(() => []),
      availableUseCases: computed(() => []),
      availableRunsOn: computed(() => []),
      filteredCount: computed(() => templates.value.length),
      totalCount: computed(() => templates.value.length),
      resetFilters: vi.fn()
    }
  }
}))

vi.mock('@/composables/useLazyPagination', () => ({
  useLazyPagination: (items: { value: unknown[] }) => ({
    paginatedItems: items,
    isLoading: ref(false),
    hasMoreItems: computed(() => false),
    loadNextPage: vi.fn(async () => {}),
    reset: vi.fn()
  })
}))

vi.mock('@/composables/useIntersectionObserver', () => ({
  useIntersectionObserver: vi.fn()
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackTemplateLibraryClosed: mocks.trackTemplateLibraryClosed
  })
}))

import WorkflowTemplateSelectorDialog from './WorkflowTemplateSelectorDialog.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderDialog() {
  return render(WorkflowTemplateSelectorDialog, {
    props: { onClose: mocks.onClose },
    global: {
      directives: { tooltip: {} },
      plugins: [i18n],
      stubs: {
        LeftSidePanel: {
          props: ['modelValue'],
          emits: ['update:modelValue'],
          template:
            "<button @click=\"$emit('update:modelValue', 'popular')\">Popular</button>"
        },
        CardContainer: {
          inheritAttrs: false,
          template:
            '<button v-bind="$attrs"><slot name="top" /><slot name="bottom" /></button>'
        },
        CardTop: {
          template:
            '<div><slot /><slot name="top-left" /><slot name="top-right" /></div>'
        },
        CardBottom: { template: '<div><slot /></div>' },
        TemplatePreview: { template: '<div><slot name="overlay" /></div>' },
        TemplateFilterControls: true,
        AsyncSearchInput: true,
        AccessibleTooltip: { template: '<div><slot /></div>' },
        Tag: { props: ['label'], template: '<span>{{ label }}</span>' },
        ProgressSpinner: true
      }
    }
  })
}

async function clickTemplateCard() {
  const user = userEvent.setup()
  const card = await screen.findByTestId(
    `template-workflow-${fixtures.template.name}`
  )
  await user.click(card)
  return { card, user }
}

describe('WorkflowTemplateSelectorDialog detail routing', () => {
  beforeEach(() => {
    runtime.isCloud = false
    runtime.isDesktop = true
    mocks.prepareWorkflowTemplateForOpen.mockResolvedValue(fixtures.prepared)
    mocks.openPreparedWorkflowTemplate.mockResolvedValue(true)
    mocks.resolveAvailability.mockResolvedValue([
      { model: fixtures.activeModel, status: 'missing' }
    ])
  })

  it('shows only active requirements when a Desktop model is missing', async () => {
    renderDialog()
    await clickTemplateCard()

    const detail = await screen.findByRole('article', {
      name: fixtures.template.title
    })
    expect(detail).toHaveFocus()
    expect(mocks.prepareWorkflowTemplateForOpen).toHaveBeenCalledWith(
      fixtures.template.name,
      'default'
    )
    expect(mocks.openPreparedWorkflowTemplate).not.toHaveBeenCalled()

    const requirements = within(detail).getByRole('region', {
      name: 'Template requirements'
    })
    expect(
      within(requirements).getByText(fixtures.activeModel.name)
    ).toBeInTheDocument()
    expect(
      within(requirements).queryByText(fixtures.bypassedModel.name)
    ).not.toBeInTheDocument()
  })

  it('opens directly outside Desktop without resolving model inventory', async () => {
    runtime.isDesktop = false
    renderDialog()
    await clickTemplateCard()

    await waitFor(() => {
      expect(mocks.openPreparedWorkflowTemplate).toHaveBeenCalledOnce()
    })
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    expect(mocks.resolveAvailability).not.toHaveBeenCalled()
  })

  it('opens a model-ready Desktop template directly', async () => {
    mocks.resolveAvailability.mockResolvedValueOnce([
      { model: fixtures.activeModel, status: 'installed' }
    ])
    renderDialog()
    await clickTemplateCard()

    await waitFor(() => {
      expect(mocks.openPreparedWorkflowTemplate).toHaveBeenCalledOnce()
    })
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('invalidates pending preparation when navigation changes', async () => {
    let resolvePreparation:
      | ((prepared: typeof fixtures.prepared) => void)
      | undefined
    mocks.prepareWorkflowTemplateForOpen.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePreparation = resolve
        })
    )
    const user = userEvent.setup()
    renderDialog()

    await user.click(
      await screen.findByTestId(`template-workflow-${fixtures.template.name}`)
    )
    await user.click(screen.getByRole('button', { name: 'Popular' }))
    resolvePreparation?.(fixtures.prepared)

    await waitFor(() => {
      expect(mocks.prepareWorkflowTemplateForOpen).toHaveBeenCalledOnce()
    })
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    expect(mocks.openPreparedWorkflowTemplate).not.toHaveBeenCalled()
  })

  it('restores list scroll and card focus after Back', async () => {
    renderDialog()
    const scrollContainer = await screen.findByTestId('base-modal-content')
    scrollContainer.scrollTop = 180

    const { card, user } = await clickTemplateCard()
    await screen.findByRole('article', { name: fixtures.template.title })
    await user.click(
      screen.getByRole('button', { name: 'Back to All Templates' })
    )

    await waitFor(() => expect(card).toHaveFocus())
    expect(scrollContainer).toHaveProperty('scrollTop', 180)
  })
})
