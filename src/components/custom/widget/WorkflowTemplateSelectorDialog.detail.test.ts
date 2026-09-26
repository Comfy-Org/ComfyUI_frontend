import { render, screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'
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
  const customPrepared = {
    ...prepared,
    sourceModule: 'custom.extension'
  }
  const inputAsset = {
    assetId: 'subject-asset',
    filename: 'subject.png',
    mediaType: 'image' as const,
    previewUrl: 'https://example.com/subject.png',
    availability: 'missing' as const
  }

  return {
    activeDownloadModel,
    activeModel,
    bypassedModel,
    customPrepared,
    doneModel,
    failedModel,
    inputAsset,
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
  getTemplateInputAssets: vi.fn(async () => [fixtures.inputAsset]),
  isModelDownloadable: vi.fn(() => true),
  loadTemplates: vi.fn(async () => true),
  loadWorkflowTemplate: vi.fn(async () => true),
  downloadTemplateInputAsset: vi.fn(async () => ({
    status: 'accepted' as const,
    download: {
      downloadId: 'input-download-1',
      filename: fixtures.inputAsset.filename,
      progress: 0,
      status: 'pending' as const
    }
  })),
  onClose: vi.fn(),
  discardPreparedWorkflowTemplate: vi.fn(),
  openPreparedWorkflowTemplate: vi.fn(async () => 'loaded' as const),
  prepareWorkflowTemplate: vi.fn(async () => fixtures.prepared),
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
      },
      ...[
        fixtures.failedModel,
        fixtures.activeDownloadModel,
        fixtures.doneModel
      ].map((model) => ({
        model,
        fileSize: 1024,
        resolution: 'resolved' as const
      }))
    ]
  })),
  rowDownloadDispose: vi.fn(),
  rowDownloadRequest: vi.fn(),
  rowDownloadStateFor: vi.fn<(model: ModelFile) => TemplateModelDownloadState>(
    () => ({ status: 'idle', attempt: 0 })
  ),
  trackTemplateLibraryClosed: vi.fn()
}))

vi.mock<unknown>(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return runtime.isCloud
  },
  get isDesktop() {
    return runtime.isDesktop
  }
}))

vi.mock<unknown>(
  import('@/platform/missingModel/missingModelDownload'),
  () => ({
    isModelDownloadable: mocks.isModelDownloadable
  })
)

vi.mock<unknown>(
  import('@/platform/workflow/templates/composables/useTemplateWorkflows'),
  () => ({
    useTemplateWorkflows: () => ({
      getTemplateDescription: mocks.getTemplateDescription,
      getTemplateThumbnailUrl: mocks.getTemplateThumbnailUrl,
      getTemplateTitle: mocks.getTemplateTitle,
      loadTemplates: mocks.loadTemplates,
      loadWorkflowTemplate: mocks.loadWorkflowTemplate,
      loadingTemplateId: computed(() => null),
      openPreparedWorkflowTemplate: mocks.openPreparedWorkflowTemplate,
      prepareWorkflowTemplate: mocks.prepareWorkflowTemplate,
      discardPreparedWorkflowTemplate: mocks.discardPreparedWorkflowTemplate
    })
  })
)

vi.mock<unknown>(
  import('@/platform/workflow/templates/composables/useTemplateModelAvailability'),
  () => ({
    useTemplateModelAvailability: () => ({
      resolveAvailability: mocks.resolveAvailability
    })
  })
)

vi.mock<unknown>(
  import('@/platform/workflow/templates/composables/useTemplateModelRowDownloads'),
  () => ({
    useTemplateModelRowDownloads: () => ({
      dispose: mocks.rowDownloadDispose,
      request: mocks.rowDownloadRequest,
      stateFor: mocks.rowDownloadStateFor
    })
  })
)

vi.mock<unknown>(
  import('@/platform/workflow/templates/utils/templateModelMetadata'),
  () => ({
    resolveTemplateModelMetadata: mocks.resolveTemplateModelMetadata
  })
)

vi.mock<unknown>(import('@/composables/useTemplateFiltering'), () => ({
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

vi.mock<unknown>(import('@/composables/useLazyPagination'), () => ({
  useLazyPagination: (items: { value: unknown[] }) => ({
    paginatedItems: items,
    isLoading: ref(false),
    hasMoreItems: computed(() => false),
    loadNextPage: vi.fn(async () => {}),
    reset: vi.fn()
  })
}))

vi.mock<unknown>(import('@/composables/useIntersectionObserver'), () => ({
  useIntersectionObserver: vi.fn()
}))

vi.mock<unknown>(import('@/platform/telemetry'), () => ({
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
    mocks.rowDownloadStateFor.mockImplementation(() => ({
      status: 'idle',
      attempt: 0
    }))
    Object.defineProperty(window, '__comfyDesktop2', {
      configurable: true,
      value: {
        isRemote: () => false,
        getTemplateInputAssets: mocks.getTemplateInputAssets,
        downloadTemplateInputAsset: mocks.downloadTemplateInputAsset
      }
    })
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

  it('shows official input assets as a read-only Detail inventory', async () => {
    const { user } = await clickTemplateCardAfterRender()
    const requirements = await screen.findByRole('region', {
      name: 'Template requirements'
    })
    const assets = within(requirements).getByRole('region', {
      name: 'Input Assets'
    })

    expect(within(assets).getByText(fixtures.inputAsset.filename)).toBeVisible()
    expect(within(assets).queryByRole('button')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open now' }))
    await waitFor(() => {
      expect(mocks.openPreparedWorkflowTemplate).toHaveBeenCalledOnce()
    })
  })

  it('does not grant custom templates access to trusted input assets', async () => {
    mocks.prepareWorkflowTemplate.mockResolvedValueOnce(fixtures.customPrepared)
    const { user } = await clickTemplateCardAfterRender()
    await screen.findByRole('article', { name: fixtures.template.title })

    expect(mocks.getTemplateInputAssets).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('region', { name: 'Input Assets' })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open now' }))
    await waitFor(() => {
      expect(mocks.openPreparedWorkflowTemplate).toHaveBeenCalledOnce()
    })
    expect(mocks.downloadTemplateInputAsset).not.toHaveBeenCalled()
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

  it('opens directly outside Desktop without resolving model inventory', async () => {
    runtime.isDesktop = false
    renderDialog()
    await clickTemplateCard()

    await waitFor(() => {
      expect(mocks.openPreparedWorkflowTemplate).toHaveBeenCalledOnce()
    })
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    expect(mocks.resolveAvailability).not.toHaveBeenCalled()
    expect(mocks.getTemplateInputAssets).not.toHaveBeenCalled()
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
      expect(mocks.prepareWorkflowTemplate).toHaveBeenCalledOnce()
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
