import { render, screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { WorkflowTemplates } from '@/platform/workflow/templates/types/template'
import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'
import type { useTemplateWorkflows } from '@/platform/workflow/templates/composables/useTemplateWorkflows'
import type { resolveTemplateModelMetadata } from '@/platform/workflow/templates/utils/templateModelMetadata'
import type { useTemplateFiltering } from '@/composables/useTemplateFiltering'
import type { useLazyPagination } from '@/composables/useLazyPagination'
import type { ResolvedTemplateModelAvailability } from '@/platform/workflow/templates/utils/templateModelAvailability'
import type { TemplateModelDownloadState } from '@/platform/workflow/templates/utils/templateModelDownloadState'
import type { ModelFile } from '@/platform/workflow/validation/schemas/workflowSchema'

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
  const failedModel = {
    name: 'failed-model.safetensors',
    directory: 'checkpoints',
    url: 'https://example.com/failed-model.safetensors'
  }
  const activeDownloadModel = {
    name: 'downloading-model.safetensors',
    directory: 'checkpoints',
    url: 'https://example.com/downloading-model.safetensors'
  }
  const doneModel = {
    name: 'done-model.safetensors',
    directory: 'checkpoints',
    url: 'https://example.com/done-model.safetensors'
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
    controller: new AbortController(),
    data: {
      template: undefined,
      json: {
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
          },
          ...[failedModel, activeDownloadModel, doneModel].map(
            (model, index) => ({
              id: index + 3,
              type: 'CheckpointLoaderSimple',
              properties: { models: [model] },
              widgets_values: [model.name]
            })
          )
        ],
        links: []
      }
    }
  }

  return {
    activeDownloadModel,
    activeModel,
    bypassedModel,
    doneModel,
    failedModel,
    prepared,
    template
  }
})

const runtime = vi.hoisted(() => ({ isCloud: false, isDesktop: true }))
const mocks = vi.hoisted(() => ({
  filterTemplatesByCategory: vi.fn(() => [fixtures.template]),
  getTemplateDescription: vi.fn(
    (template: { description: string }) => template.description
  ),
  getTemplateThumbnailUrl: vi.fn(() => '/thumbnail.webp'),
  getTemplateTitle: vi.fn((template: { title: string }) => template.title),
  isModelDownloadable: vi.fn(() => true),
  loadTemplates: vi.fn(async () => true),
  onClose: vi.fn(),
  discardPreparedWorkflowTemplate: vi.fn(),
  openPreparedWorkflowTemplate: vi.fn<
    () => Promise<'loaded' | 'graph-failed' | 'not-started'>
  >(async () => 'loaded'),
  prepareWorkflowTemplate: vi.fn(async () => fixtures.prepared),
  resolveAvailability: vi.fn<
    () => Promise<ResolvedTemplateModelAvailability[]>
  >(async () => [{ model: fixtures.activeModel, status: 'missing' }]),
  resolveTemplateModelMetadata: vi.fn<typeof resolveTemplateModelMetadata>(
    async () => ({
      status: 'completed',
      entries: [
        fixtures.activeModel,
        fixtures.failedModel,
        fixtures.activeDownloadModel,
        fixtures.doneModel
      ].map((model) => ({ model, fileSize: 1024, gatedRepoUrl: null }))
    })
  ),
  rowDownloadDispose: vi.fn(),
  rowDownloadRequest: vi.fn(),
  rowDownloadStateFor: vi.fn<(model: ModelFile) => TemplateModelDownloadState>(
    () => ({ status: 'idle', attempt: 0 })
  ),
  trackTemplateLibraryClosed: vi.fn(),
  reportError: vi.fn(),
  modelDownloadNeedsFolderPaths: vi.fn(() => true),
  loadFolderPathsOnce: vi.fn(async () => ({
    checkpoints: ['/models/checkpoints']
  }))
}))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return runtime.isCloud
  },
  get isDesktop() {
    return runtime.isDesktop
  }
}))

vi.mock(import('@/platform/missingModel/missingModelDownload'), () => ({
  isModelDownloadable: mocks.isModelDownloadable,
  modelDownloadNeedsFolderPaths: mocks.modelDownloadNeedsFolderPaths
}))

vi.mock(import('@/platform/missingModel/folderPathCache'), () => ({
  loadFolderPathsOnce: mocks.loadFolderPathsOnce
}))

vi.mock(
  import('@/platform/workflow/templates/composables/useTemplateWorkflows'),
  () => ({
    useTemplateWorkflows: () =>
      ({
        selectedTemplate: ref<string | null>(null),
        loadingTemplateId: computed(() => null),
        isTemplatesLoaded: computed(() => true),
        allTemplateGroups: computed<WorkflowTemplates[]>(() => []),
        loadTemplates: mocks.loadTemplates,
        selectFirstTemplateCategory: vi.fn(),
        // Narrowing predicate the dialog never calls; satisfied, not modelled.
        selectTemplateCategory: (
          category: WorkflowTemplates | null
        ): category is WorkflowTemplates => category !== null,
        getTemplateThumbnailUrl: mocks.getTemplateThumbnailUrl,
        getTemplateTitle: mocks.getTemplateTitle,
        getTemplateDescription: mocks.getTemplateDescription,
        prepareWorkflowTemplate: mocks.prepareWorkflowTemplate,
        openPreparedWorkflowTemplate: mocks.openPreparedWorkflowTemplate,
        discardPreparedWorkflowTemplate: mocks.discardPreparedWorkflowTemplate,
        loadWorkflowTemplate: vi.fn(async () => 'loaded' as const)
      }) as unknown as ReturnType<typeof useTemplateWorkflows>
  })
)

vi.mock(
  import('@/platform/workflow/templates/composables/useTemplateModelAvailability'),
  () => ({
    useTemplateModelAvailability: () => ({
      resolveAvailability: mocks.resolveAvailability
    })
  })
)

vi.mock(
  import('@/platform/workflow/templates/composables/useTemplateModelRowDownloads'),
  () => ({
    useTemplateModelRowDownloads: () => ({
      dispose: mocks.rowDownloadDispose,
      request: mocks.rowDownloadRequest,
      stateFor: mocks.rowDownloadStateFor
    })
  })
)

vi.mock(
  import('@/platform/workflow/templates/utils/templateModelMetadata'),
  () => ({
    resolveTemplateModelMetadata: mocks.resolveTemplateModelMetadata
  })
)

vi.mock(import('@/composables/useTemplateFiltering'), () => ({
  useTemplateFiltering: ((templates: {
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
  }) as unknown as typeof useTemplateFiltering
}))

vi.mock(import('@/composables/useLazyPagination'), () => ({
  useLazyPagination: ((items: { value: unknown[] }) => ({
    paginatedItems: items,
    isLoading: ref(false),
    hasMoreItems: computed(() => false),
    loadNextPage: vi.fn(async () => {}),
    reset: vi.fn()
  })) as unknown as typeof useLazyPagination
}))

vi.mock(import('@/composables/useIntersectionObserver'), () => ({
  useIntersectionObserver: vi.fn()
}))

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: mocks.reportError
}))

vi.mock(import('@/platform/telemetry'))

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
        TemplatePreview: {
          props: ['isHovered'],
          template:
            '<div :data-hovered="String(isHovered)"><slot name="overlay" /></div>'
        },
        TemplateFilterControls: true,
        AsyncSearchInput: true,
        AccessibleTooltip: { template: '<div><slot /></div>' },
        Tag: { props: ['label'], template: '<span>{{ label }}</span>' }
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

async function clickTemplateCardAfterRender() {
  renderDialog()
  return clickTemplateCard()
}

describe('WorkflowTemplateSelectorDialog detail routing', () => {
  beforeEach(() => {
    const workflowTemplatesStore = useWorkflowTemplatesStore()
    Object.assign(workflowTemplatesStore, {
      enhancedTemplates: [fixtures.template],
      navGroupedTemplates: [
        { id: 'all', label: 'All Templates' },
        { id: 'popular', label: 'Popular' }
      ]
    })
    vi.mocked(
      workflowTemplatesStore.filterTemplatesByCategory
    ).mockImplementation(mocks.filterTemplatesByCategory)
    vi.mocked(workflowTemplatesStore.loadWorkflowTemplates).mockResolvedValue()
    runtime.isCloud = false
    runtime.isDesktop = true
    mocks.prepareWorkflowTemplate.mockResolvedValue(fixtures.prepared)
    mocks.openPreparedWorkflowTemplate.mockResolvedValue('loaded')
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
    expect(mocks.prepareWorkflowTemplate).toHaveBeenCalledWith(
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

  it('keeps an individual model download inside the mounted Detail', async () => {
    const { user } = await clickTemplateCardAfterRender()

    await user.click(
      await screen.findByRole('button', {
        name: `Download ${fixtures.activeModel.name}`
      })
    )

    expect(mocks.rowDownloadRequest).toHaveBeenCalledWith(fixtures.activeModel)
    expect(
      screen.getByRole('article', { name: fixtures.template.title })
    ).toBeInTheDocument()
    expect(mocks.openPreparedWorkflowTemplate).not.toHaveBeenCalled()
  })

  it('keeps Open now passive for idle models', async () => {
    const { user } = await clickTemplateCardAfterRender()
    await user.click(await screen.findByRole('button', { name: 'Open now' }))

    await waitFor(() => {
      expect(mocks.openPreparedWorkflowTemplate).toHaveBeenCalledOnce()
    })
    expect(mocks.prepareWorkflowTemplate).toHaveBeenCalledOnce()
    expect(mocks.openPreparedWorkflowTemplate).toHaveBeenCalledWith(
      fixtures.prepared
    )
    expect(mocks.rowDownloadRequest).not.toHaveBeenCalled()
  })

  it('starts eligible rows before Download models & open opens the workflow', async () => {
    mocks.resolveAvailability.mockResolvedValueOnce(
      [
        fixtures.activeModel,
        fixtures.failedModel,
        fixtures.activeDownloadModel,
        fixtures.doneModel
      ].map((model) => ({ model, status: 'missing' as const }))
    )
    mocks.rowDownloadStateFor.mockImplementation((model) => {
      if (model.name === fixtures.failedModel.name) {
        return {
          status: 'failed' as const,
          attempt: 1,
          reason: 'error' as const
        }
      }
      if (model.name === fixtures.activeDownloadModel.name) {
        return {
          status: 'downloading' as const,
          attempt: 1,
          activity: 'active' as const,
          receivedBytes: 1,
          totalBytes: 2,
          fraction: 0.5
        }
      }
      if (model.name === fixtures.doneModel.name) {
        return { status: 'done' as const, attempt: 1 }
      }
      return { status: 'idle' as const, attempt: 0 }
    })
    const { user } = await clickTemplateCardAfterRender()
    await user.click(
      await screen.findByRole('button', { name: 'Download models & open' })
    )

    await waitFor(() => {
      expect(mocks.openPreparedWorkflowTemplate).toHaveBeenCalledOnce()
    })
    expect(mocks.prepareWorkflowTemplate).toHaveBeenCalledOnce()
    expect(mocks.openPreparedWorkflowTemplate).toHaveBeenCalledWith(
      fixtures.prepared
    )
    expect(mocks.rowDownloadRequest.mock.calls).toEqual([
      [fixtures.activeModel],
      [fixtures.failedModel]
    ])
    expect(mocks.rowDownloadRequest.mock.invocationCallOrder[1]).toBeLessThan(
      mocks.openPreparedWorkflowTemplate.mock.invocationCallOrder[0]
    )
  })

  it('applies the resolved model size to the visible row', async () => {
    let resolveMetadata:
      | ((
          value: Awaited<ReturnType<typeof mocks.resolveTemplateModelMetadata>>
        ) => void)
      | undefined
    mocks.resolveTemplateModelMetadata.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveMetadata = resolve
        })
    )
    renderDialog()
    await clickTemplateCard()

    const detail = await screen.findByRole('article', {
      name: fixtures.template.title
    })
    expect(
      within(detail).getByText(/^Checkpoints · Used by Active loader$/)
    ).toBeInTheDocument()

    resolveMetadata?.({
      status: 'completed',
      entries: [
        { model: fixtures.activeModel, fileSize: 1024, gatedRepoUrl: null }
      ]
    })

    await waitFor(() => {
      expect(
        within(detail).getByText(/^Checkpoints · 1 KB · Used by Active loader$/)
      ).toBeInTheDocument()
    })
  })

  it.for([
    {
      name: 'a rejected metadata batch',
      outcome: () =>
        mocks.resolveTemplateModelMetadata.mockRejectedValueOnce(
          new Error('metadata unavailable')
        ),
      reports: true
    },
    {
      name: 'an aborted metadata batch',
      outcome: () =>
        mocks.resolveTemplateModelMetadata.mockResolvedValueOnce({
          status: 'aborted' as const
        }),
      reports: false
    }
  ])('keeps Detail usable after $name', async ({ outcome, reports }) => {
    outcome()
    renderDialog()
    await clickTemplateCard()

    const detail = await screen.findByRole('article', {
      name: fixtures.template.title
    })

    await waitFor(() => {
      expect(
        within(detail).getByText(/^Checkpoints · Used by Active loader$/)
      ).toBeInTheDocument()
    })
    expect(detail).toBeInTheDocument()
    expect(mocks.openPreparedWorkflowTemplate).not.toHaveBeenCalled()

    if (reports) {
      expect(mocks.reportError).toHaveBeenCalledOnce()
    } else {
      expect(mocks.reportError).not.toHaveBeenCalled()
    }
  })

  it('tracks the pointer over the detail preview', async () => {
    renderDialog()
    const { user } = await clickTemplateCard()

    const detail = await screen.findByRole('article', {
      name: fixtures.template.title
    })
    const preview = within(detail).getByTestId('detail-preview')
    expect(preview).toHaveAttribute('data-hovered', 'false')

    await user.hover(preview)
    expect(preview).toHaveAttribute('data-hovered', 'true')

    await user.unhover(preview)
    expect(preview).toHaveAttribute('data-hovered', 'false')
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

  it('opens directly when inventory cannot confirm a missing model', async () => {
    mocks.resolveAvailability.mockResolvedValueOnce([
      { model: fixtures.activeModel, status: 'unknown' }
    ])
    renderDialog()
    await clickTemplateCard()

    await waitFor(() => {
      expect(mocks.resolveAvailability).toHaveBeenCalledOnce()
      expect(mocks.openPreparedWorkflowTemplate).toHaveBeenCalledOnce()
    })
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('lets a later open proceed after one does not start', async () => {
    mocks.resolveAvailability.mockResolvedValue([
      { model: fixtures.activeModel, status: 'installed' }
    ])
    mocks.openPreparedWorkflowTemplate.mockResolvedValueOnce('not-started')
    renderDialog()
    await clickTemplateCard()

    await waitFor(() => {
      expect(mocks.openPreparedWorkflowTemplate).toHaveBeenCalledOnce()
    })
    expect(mocks.onClose).not.toHaveBeenCalled()

    await clickTemplateCard()

    await waitFor(() => {
      expect(mocks.openPreparedWorkflowTemplate).toHaveBeenCalledTimes(2)
    })
    expect(mocks.onClose).toHaveBeenCalledOnce()
  })

  it('discards the prepared workflow when navigation changes while inventory resolves', async () => {
    let resolveAvailability:
      | ((value: ResolvedTemplateModelAvailability[]) => void)
      | undefined
    mocks.resolveAvailability.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveAvailability = resolve
        })
    )
    const user = userEvent.setup()
    renderDialog()
    await clickTemplateCard()
    await waitFor(() => {
      expect(mocks.resolveAvailability).toHaveBeenCalledOnce()
    })

    await user.click(screen.getByRole('button', { name: 'Popular' }))
    resolveAvailability?.([{ model: fixtures.activeModel, status: 'missing' }])
    await waitFor(() => {
      expect(mocks.discardPreparedWorkflowTemplate).toHaveBeenCalledWith(
        fixtures.prepared
      )
    })
    expect(mocks.openPreparedWorkflowTemplate).not.toHaveBeenCalled()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('discards the prepared workflow when a filter change clears a visible Detail', async () => {
    mocks.resolveAvailability.mockResolvedValueOnce([
      { model: fixtures.activeModel, status: 'missing' }
    ])
    const user = userEvent.setup()
    renderDialog()
    await clickTemplateCard()
    await screen.findByRole('article', { name: fixtures.template.title })
    mocks.discardPreparedWorkflowTemplate.mockClear()

    await user.click(screen.getByRole('button', { name: 'Popular' }))

    await waitFor(() => {
      expect(mocks.discardPreparedWorkflowTemplate).toHaveBeenCalledWith(
        fixtures.prepared
      )
    })
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('invalidates pending preparation when navigation changes', async () => {
    let resolvePreparation:
      | ((prepared: typeof fixtures.prepared) => void)
      | undefined
    mocks.prepareWorkflowTemplate.mockImplementationOnce(
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
      expect(mocks.discardPreparedWorkflowTemplate).toHaveBeenCalledWith(
        fixtures.prepared
      )
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
    scrollContainer.scrollTop = 0
    await user.click(
      screen.getByRole('button', { name: 'Back to All Templates' })
    )

    await waitFor(() => expect(card).toHaveFocus())
    expect(scrollContainer).toHaveProperty('scrollTop', 180)
  })
})
