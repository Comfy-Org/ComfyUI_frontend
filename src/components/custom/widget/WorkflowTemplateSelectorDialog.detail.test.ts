import { render, screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { TemplateModelMetadataBatchResult } from '@/platform/workflow/templates/utils/templateModelMetadata'
import type { ResolvedTemplateModelAvailability } from '@/platform/workflow/templates/utils/templateModelAvailability'

const fixtures = vi.hoisted(() => {
  const model = {
    name: 'wan2.2_i2v_high_noise_14B_fp16.safetensors',
    directory: 'checkpoints',
    url: 'https://example.com/wan2.2.safetensors'
  }
  const template = {
    name: 'starter-detail',
    title: 'Starter Detail',
    description: 'Inspect this workflow before opening it.',
    mediaType: 'image',
    mediaSubtype: 'webp',
    size: 1024
  }
  const secondTemplate = {
    name: 'second-detail',
    title: 'Second Detail',
    description: 'A second workflow to inspect.',
    mediaType: 'image',
    mediaSubtype: 'webp'
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
          title: 'Starter Loader',
          properties: { models: [model] },
          widgets_values: [model.name]
        }
      ],
      links: [],
      models: [model]
    }
  }
  const secondPrepared = {
    id: secondTemplate.name,
    sourceModule: 'default',
    workflowName: secondTemplate.title,
    workflow: { nodes: [], links: [] }
  }

  return { prepared, secondPrepared, secondTemplate, template }
})

const environment = vi.hoisted(() => ({
  isCloud: false,
  isDesktop: false
}))

const mocks = vi.hoisted(() => ({
  filterTemplatesByCategory: vi.fn(() => [
    fixtures.template,
    fixtures.secondTemplate
  ]),
  getTemplateDescription: vi.fn(
    (template: { description: string }) => template.description
  ),
  getTemplateThumbnailUrl: vi.fn(() => '/thumbnail.webp'),
  getTemplateTitle: vi.fn((template: { title: string }) => template.title),
  loadTemplates: vi.fn(async () => true),
  isModelDownloadable: vi.fn(() => true),
  resolveModelAvailability: vi.fn(
    async (
      models: readonly (typeof fixtures.prepared.workflow.models)[number][]
    ): Promise<ResolvedTemplateModelAvailability[]> =>
      models.map((model) => ({ model, status: 'missing' }))
  ),
  resolveModelMetadata: vi.fn(
    async (
      models: readonly (typeof fixtures.prepared.workflow.models)[number][],
      _options?: { signal?: AbortSignal }
    ): Promise<TemplateModelMetadataBatchResult> => ({
      status: 'completed',
      entries: models.map((model) => ({
        model,
        resolution: 'resolved',
        fileSize: 2048,
        gatedRepoUrl: null
      }))
    })
  ),
  rowDownloadDispose: vi.fn(),
  rowDownloadRequest: vi.fn(),
  rowDownloadStateFor: vi.fn(() => ({ status: 'idle' as const, attempt: 0 })),
  onClose: vi.fn(),
  openPreparedWorkflowTemplate: vi.fn(async () => true),
  prepareWorkflowTemplate: vi.fn(
    async (
      id: string
    ): Promise<
      typeof fixtures.prepared | typeof fixtures.secondPrepared | null
    > =>
      id === fixtures.secondTemplate.name
        ? fixtures.secondPrepared
        : fixtures.prepared
  ),
  trackTemplateLibraryClosed: vi.fn()
}))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return environment.isCloud
  },
  get isDesktop() {
    return environment.isDesktop
  }
}))

vi.mock(
  '@/platform/workflow/templates/composables/useTemplateModelAvailability',
  () => ({
    useTemplateModelAvailability: () => ({
      resolveAvailability: mocks.resolveModelAvailability
    })
  })
)

vi.mock(
  '@/platform/workflow/templates/composables/useTemplateModelRowDownloads',
  () => ({
    useTemplateModelRowDownloads: () => ({
      dispose: mocks.rowDownloadDispose,
      request: mocks.rowDownloadRequest,
      stateFor: mocks.rowDownloadStateFor
    })
  })
)

vi.mock('@/platform/workflow/templates/utils/templateModelMetadata', () => ({
  resolveTemplateModelMetadata: mocks.resolveModelMetadata
}))

vi.mock('@/platform/missingModel/missingModelDownload', () => ({
  isModelDownloadable: mocks.isModelDownloadable
}))

vi.mock('@/scripts/api', () => ({
  api: { getFolderPaths: vi.fn(async () => ({})) }
}))

vi.mock(
  '@/platform/workflow/templates/composables/useTemplateWorkflows',
  () => ({
    useTemplateWorkflows: () => ({
      getTemplateDescription: mocks.getTemplateDescription,
      getTemplateThumbnailUrl: mocks.getTemplateThumbnailUrl,
      getTemplateTitle: mocks.getTemplateTitle,
      loadTemplates: mocks.loadTemplates,
      openPreparedWorkflowTemplate: mocks.openPreparedWorkflowTemplate,
      prepareWorkflowTemplate: mocks.prepareWorkflowTemplate
    })
  })
)

vi.mock(
  '@/platform/workflow/templates/repositories/workflowTemplatesStore',
  () => ({
    useWorkflowTemplatesStore: () => ({
      enhancedTemplates: [fixtures.template, fixtures.secondTemplate],
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

vi.mock('@/composables/useTemplateFiltering', async () => {
  const { computed, ref } = await import('vue')

  return {
    useTemplateFiltering: (templates: {
      value: (typeof fixtures.template | typeof fixtures.secondTemplate)[]
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
  }
})

vi.mock('@/composables/useLazyPagination', async () => {
  const { computed, ref } = await import('vue')

  return {
    useLazyPagination: (items: { value: unknown[] }) => ({
      paginatedItems: items,
      isLoading: ref(false),
      hasMoreItems: computed(() => false),
      loadNextPage: vi.fn(async () => {}),
      reset: vi.fn()
    })
  }
})

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
        BaseModalLayout: {
          template: `
            <div>
              <slot name="leftPanel" />
              <slot name="header" />
              <slot name="contentFilter" />
              <slot name="content" />
            </div>
          `
        },
        LeftSidePanel: {
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

async function openDetail(templateName = fixtures.template.name) {
  const user = userEvent.setup()
  renderDialog()
  await user.click(
    await screen.findByTestId(`template-workflow-${templateName}`)
  )
  await screen.findByRole('article', {
    name:
      templateName === fixtures.template.name
        ? fixtures.template.title
        : fixtures.secondTemplate.title
  })
  return user
}

describe('WorkflowTemplateSelectorDialog template detail navigation', () => {
  beforeEach(() => {
    environment.isCloud = false
    environment.isDesktop = false
    mocks.prepareWorkflowTemplate.mockImplementation(async (id: string) =>
      id === fixtures.secondTemplate.name
        ? fixtures.secondPrepared
        : fixtures.prepared
    )
    mocks.openPreparedWorkflowTemplate.mockResolvedValue(true)
  })

  it('enriches Desktop model rows and keeps a row download inside the detail', async () => {
    environment.isDesktop = true
    const user = await openDetail()

    await waitFor(() => {
      expect(mocks.resolveModelMetadata).toHaveBeenCalledOnce()
    })
    expect(mocks.resolveModelAvailability).toHaveBeenCalledWith([
      fixtures.prepared.workflow.models[0]
    ])
    expect(
      screen.getByText('Checkpoint · 2 KB · Used by Starter Loader')
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', {
        name: 'Download wan2.2_i2v_high_noise_14B_fp16.safetensors'
      })
    )
    expect(mocks.rowDownloadRequest).toHaveBeenCalledWith(
      fixtures.prepared.workflow.models[0]
    )
    expect(
      screen.getByRole('article', { name: fixtures.template.title })
    ).toBeInTheDocument()
    expect(mocks.openPreparedWorkflowTemplate).not.toHaveBeenCalled()
  })

  it('aborts Desktop metadata when leaving Detail', async () => {
    environment.isDesktop = true
    let signal: AbortSignal | undefined
    mocks.resolveModelMetadata.mockImplementationOnce((_models, options) => {
      signal = options?.signal
      return new Promise<TemplateModelMetadataBatchResult>(() => undefined)
    })
    const user = await openDetail()

    await waitFor(() => expect(signal).toBeDefined())
    expect(signal?.aborted).toBe(false)

    await user.click(
      screen.getByRole('button', { name: 'Back to All Templates' })
    )

    expect(signal?.aborted).toBe(true)
  })

  it('starts eligible Desktop model rows before immediately opening the stored workflow', async () => {
    environment.isDesktop = true
    const user = await openDetail()
    await screen.findByRole('button', { name: 'Download starter pack' })

    await user.click(
      screen.getByRole('button', { name: 'Download starter pack' })
    )

    await waitFor(() => {
      expect(mocks.openPreparedWorkflowTemplate).toHaveBeenCalledOnce()
    })
    expect(mocks.rowDownloadRequest).toHaveBeenCalledWith(
      fixtures.prepared.workflow.models[0]
    )
    expect(mocks.rowDownloadRequest.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.openPreparedWorkflowTemplate.mock.invocationCallOrder[0]
    )
    expect(mocks.openPreparedWorkflowTemplate).toHaveBeenCalledWith(
      fixtures.prepared,
      { closeDialog: false }
    )
    expect(mocks.onClose).toHaveBeenCalledOnce()
  })

  it('opens Desktop templates directly when every declared model is installed', async () => {
    environment.isDesktop = true
    mocks.resolveModelAvailability.mockResolvedValueOnce([
      {
        model: fixtures.prepared.workflow.models[0],
        status: 'installed'
      }
    ])
    const user = userEvent.setup()
    renderDialog()

    await user.click(
      await screen.findByTestId(`template-workflow-${fixtures.template.name}`)
    )

    await waitFor(() => {
      expect(mocks.openPreparedWorkflowTemplate).toHaveBeenCalledOnce()
    })
    expect(mocks.openPreparedWorkflowTemplate).toHaveBeenCalledWith(
      fixtures.prepared,
      { closeDialog: false }
    )
    expect(
      screen.queryByRole('article', { name: fixtures.template.title })
    ).not.toBeInTheDocument()
    expect(mocks.resolveModelMetadata).not.toHaveBeenCalled()
    expect(mocks.onClose).toHaveBeenCalledOnce()
  })

  it.for([
    {
      scenario: 'model availability is unknown',
      expectedStatus: 'Unknown',
      arrange: () =>
        mocks.resolveModelAvailability.mockResolvedValueOnce([
          {
            model: fixtures.prepared.workflow.models[0],
            status: 'unknown'
          }
        ])
    },
    {
      scenario: 'the host cannot download the model',
      expectedStatus: 'Unavailable',
      arrange: () => mocks.isModelDownloadable.mockReturnValueOnce(false)
    },
    {
      scenario: 'model metadata resolution fails',
      expectedStatus: 'Unknown',
      arrange: () =>
        mocks.resolveModelMetadata.mockResolvedValueOnce({
          status: 'completed',
          entries: [
            {
              model: fixtures.prepared.workflow.models[0],
              resolution: 'failed',
              fileSize: null,
              gatedRepoUrl: null
            }
          ]
        })
    }
  ])(
    'keeps Desktop detail usable when $scenario',
    async ({ arrange, expectedStatus }) => {
      environment.isDesktop = true
      arrange()

      await openDetail()

      expect(await screen.findByText(expectedStatus)).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Open without downloading' })
      ).toBeEnabled()
      expect(
        screen.queryByRole('button', { name: 'Download starter pack' })
      ).not.toBeInTheDocument()
    }
  )

  it('opens Desktop templates without model declarations directly', async () => {
    environment.isDesktop = true
    const user = userEvent.setup()
    renderDialog()

    await user.click(
      await screen.findByTestId(
        `template-workflow-${fixtures.secondTemplate.name}`
      )
    )

    await waitFor(() => {
      expect(mocks.openPreparedWorkflowTemplate).toHaveBeenCalledOnce()
    })
    expect(mocks.openPreparedWorkflowTemplate).toHaveBeenCalledWith(
      fixtures.secondPrepared,
      { closeDialog: false }
    )
    expect(mocks.resolveModelAvailability).not.toHaveBeenCalled()
    expect(mocks.resolveModelMetadata).not.toHaveBeenCalled()
    expect(mocks.onClose).toHaveBeenCalledOnce()
  })

  it('opens Cloud templates directly without presenting Detail', async () => {
    environment.isCloud = true
    const user = userEvent.setup()
    renderDialog()

    await user.click(
      await screen.findByTestId(`template-workflow-${fixtures.template.name}`)
    )

    await waitFor(() => {
      expect(mocks.openPreparedWorkflowTemplate).toHaveBeenCalledOnce()
    })
    expect(mocks.openPreparedWorkflowTemplate).toHaveBeenCalledWith(
      fixtures.prepared,
      { closeDialog: false }
    )
    expect(
      screen.queryByRole('article', { name: fixtures.template.title })
    ).not.toBeInTheDocument()
    expect(mocks.resolveModelAvailability).not.toHaveBeenCalled()
    expect(mocks.resolveModelMetadata).not.toHaveBeenCalled()
    expect(mocks.onClose).toHaveBeenCalledOnce()
  })

  it('keeps localhost detail behavior declaration-only', async () => {
    await openDetail()

    expect(mocks.resolveModelAvailability).not.toHaveBeenCalled()
    expect(mocks.resolveModelMetadata).not.toHaveBeenCalled()
    expect(mocks.rowDownloadStateFor).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Open template' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Download starter pack' })
    ).not.toBeInTheDocument()
  })

  it('prepares a clicked template and presents its declarations before opening', async () => {
    await openDetail()

    expect(mocks.prepareWorkflowTemplate).toHaveBeenCalledOnce()
    expect(mocks.prepareWorkflowTemplate).toHaveBeenCalledWith(
      fixtures.template.name,
      'default'
    )
    expect(mocks.openPreparedWorkflowTemplate).not.toHaveBeenCalled()
    expect(mocks.onClose).not.toHaveBeenCalled()

    const requirements = screen.getByRole('region', {
      name: 'Template requirements'
    })
    expect(
      within(requirements).getByText(
        'wan2.2_i2v_high_noise_14B_fp16.safetensors'
      )
    ).toBeInTheDocument()
    expect(
      within(requirements).getByText('Checkpoints · Used by Starter Loader')
    ).toBeInTheDocument()
    expect(within(requirements).getByText('1 KB')).toBeInTheDocument()
  })

  it('uses one combined category/back button and keeps the sidebar navigable', async () => {
    const user = await openDetail()

    const breadcrumb = screen.getByRole('navigation', {
      name: 'Template navigation'
    })
    const backButton = within(breadcrumb).getByRole('button', {
      name: 'Back to All Templates'
    })
    expect(within(breadcrumb).getAllByRole('button')).toEqual([backButton])

    await user.click(backButton)
    expect(
      await screen.findByTestId(`template-workflow-${fixtures.template.name}`)
    ).toBeVisible()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()

    await user.click(
      screen.getByTestId(`template-workflow-${fixtures.template.name}`)
    )
    await screen.findByRole('article', { name: fixtures.template.title })
    await user.click(screen.getByRole('button', { name: 'Popular' }))

    expect(
      await screen.findByTestId(`template-workflow-${fixtures.template.name}`)
    ).toBeVisible()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    expect(mocks.filterTemplatesByCategory).toHaveBeenLastCalledWith('popular')
  })

  it('opens the stored preparation once and closes only after success', async () => {
    const user = await openDetail()

    await user.click(screen.getByRole('button', { name: 'Open template' }))

    await waitFor(() => {
      expect(mocks.openPreparedWorkflowTemplate).toHaveBeenCalledOnce()
    })
    expect(mocks.openPreparedWorkflowTemplate).toHaveBeenCalledWith(
      fixtures.prepared,
      { closeDialog: false }
    )
    expect(mocks.prepareWorkflowTemplate).toHaveBeenCalledOnce()
    expect(mocks.onClose).toHaveBeenCalledOnce()
  })

  it('keeps the detail open when preparation or graph opening fails', async () => {
    mocks.prepareWorkflowTemplate.mockResolvedValueOnce(null)
    const user = userEvent.setup()
    renderDialog()
    const card = await screen.findByTestId(
      `template-workflow-${fixtures.template.name}`
    )

    await user.click(card)
    await waitFor(() => {
      expect(mocks.prepareWorkflowTemplate).toHaveBeenCalledOnce()
    })
    expect(card).toBeVisible()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    expect(mocks.onClose).not.toHaveBeenCalled()

    mocks.openPreparedWorkflowTemplate.mockResolvedValueOnce(false)
    await user.click(card)
    await screen.findByRole('article', { name: fixtures.template.title })
    await user.click(screen.getByRole('button', { name: 'Open template' }))
    await waitFor(() => {
      expect(mocks.openPreparedWorkflowTemplate).toHaveBeenCalledOnce()
    })
    expect(
      screen.getByRole('article', { name: fixtures.template.title })
    ).toBeInTheDocument()
    expect(mocks.onClose).not.toHaveBeenCalled()
  })

  it('ignores a stale preparation that resolves after a newer click', async () => {
    let resolveFirst: ((value: typeof fixtures.prepared) => void) | undefined
    let resolveSecond:
      | ((value: typeof fixtures.secondPrepared) => void)
      | undefined
    mocks.prepareWorkflowTemplate.mockImplementation(
      (id: string) =>
        new Promise((resolve) => {
          if (id === fixtures.template.name) resolveFirst = resolve
          else resolveSecond = resolve
        })
    )
    const user = userEvent.setup()
    renderDialog()

    await user.click(
      await screen.findByTestId(`template-workflow-${fixtures.template.name}`)
    )
    await user.click(
      screen.getByTestId(`template-workflow-${fixtures.secondTemplate.name}`)
    )
    resolveSecond?.(fixtures.secondPrepared)
    await screen.findByRole('article', { name: fixtures.secondTemplate.title })

    resolveFirst?.(fixtures.prepared)
    await waitFor(() => {
      expect(
        screen.getByRole('article', { name: fixtures.secondTemplate.title })
      ).toBeInTheDocument()
    })
    expect(
      screen.queryByRole('article', { name: fixtures.template.title })
    ).not.toBeInTheDocument()
  })
})
