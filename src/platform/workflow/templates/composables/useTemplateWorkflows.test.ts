import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ReportErrorOptions } from '@/platform/telemetry/reportError'
import { useTemplateWorkflows } from '@/platform/workflow/templates/composables/useTemplateWorkflows'
import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'
import { app } from '@/scripts/app'

const { mockCaptureException, mockAddError } = vi.hoisted(() => ({
  mockCaptureException: vi.fn(),
  mockAddError: vi.fn()
}))

vi.mock('@sentry/vue', () => ({
  captureException: mockCaptureException,
  isEnabled: () => true
}))

vi.mock('@datadog/browser-rum', () => ({
  datadogRum: {
    addError: mockAddError,
    getInitConfiguration: () => ({})
  }
}))

function expectReportedFailure(
  error: Error,
  { errorType, tags, context }: ReportErrorOptions
) {
  expect(mockCaptureException).toHaveBeenCalledExactlyOnceWith(error, {
    tags: { ...tags, error_type: errorType },
    extra: context,
    level: undefined
  })
  expect(mockAddError).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ name: errorType, message: error.message }),
    { ...context, ...tags, error_type: errorType }
  )
}

const { mockCloseDialog } = vi.hoisted(() => ({ mockCloseDialog: vi.fn() }))

async function flushPromises() {
  await new Promise((r) => setTimeout(r, 0))
}

// Mock the store
vi.mock(
  '@/platform/workflow/templates/repositories/workflowTemplatesStore',
  () => ({
    useWorkflowTemplatesStore: vi.fn()
  })
)

// Mock the API
vi.mock('@/scripts/api', () => ({
  api: {
    fileURL: vi.fn((path) => `mock-file-url${path}`),
    apiURL: vi.fn((path) => `mock-api-url${path}`)
  }
}))

// loadGraphData resolves to the workflow it activated; the education card
// binds to that, so the mock returns a per-test workflow object.
const { mockLoadedWorkflow } = vi.hoisted(
  (): { mockLoadedWorkflow: { value: { key: string } | undefined } } => ({
    mockLoadedWorkflow: {
      value: { key: 'loaded-template' }
    }
  })
)

vi.mock('@/scripts/app', () => ({
  app: {
    loadGraphData: vi.fn(() => Promise.resolve(mockLoadedWorkflow.value))
  }
}))

// Mock Vue I18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: vi.fn((key, fallback) => fallback || key)
  }),
  createI18n: () => ({
    global: {
      t: (key: string) => key
    }
  })
}))

// Mock the dialog store
vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: vi.fn(() => ({
    closeDialog: mockCloseDialog
  }))
}))

// useTelemetry() returns null in OSS, a dispatcher in cloud — toggle via mockIsCloud.
const { mockIsCloud, mockTrackTemplate } = vi.hoisted(() => ({
  mockIsCloud: { value: true },
  mockTrackTemplate: vi.fn()
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () =>
    mockIsCloud.value ? { trackTemplate: mockTrackTemplate } : null
}))

const { mockDistributionIsCloud, mockRequestCard, mockDismissCard } =
  vi.hoisted(() => ({
    mockDistributionIsCloud: { value: false },
    mockRequestCard: vi.fn(),
    mockDismissCard: vi.fn()
  }))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockDistributionIsCloud.value
  }
}))

vi.mock(
  '@/platform/workflow/templates/stores/partnerNodesEducationStore',
  () => ({
    usePartnerNodesEducationStore: () => ({
      requestCard: mockRequestCard,
      dismissCard: mockDismissCard
    })
  })
)

// Mock fetch
global.fetch = vi.fn()

type MockWorkflowTemplatesStore = ReturnType<typeof useWorkflowTemplatesStore>

describe('useTemplateWorkflows', () => {
  let mockWorkflowTemplatesStore: MockWorkflowTemplatesStore

  beforeEach(() => {
    mockIsCloud.value = true
    mockDistributionIsCloud.value = false
    mockLoadedWorkflow.value = { key: 'loaded-template' }

    mockWorkflowTemplatesStore = {
      isLoaded: false,
      loadWorkflowTemplates: vi.fn().mockResolvedValue(true),
      enhancedTemplates: [],
      getTemplateByName: vi.fn((name: string) =>
        name === 'template1'
          ? {
              name,
              mediaType: 'image',
              mediaSubtype: 'jpg',
              sourceModule: 'default',
              description: 'Template 1 description',
              io: {
                inputs: [
                  {
                    nodeId: 2,
                    nodeType: 'LoadImage',
                    file: 'starter.png',
                    mediaType: 'image'
                  }
                ]
              }
            }
          : undefined
      ),
      groupedTemplates: [
        {
          label: 'ComfyUI Examples',
          modules: [
            {
              moduleName: 'all',
              title: 'All',
              localizedTitle: 'All Templates',
              templates: [
                {
                  name: 'template1',
                  mediaType: 'image',
                  mediaSubtype: 'jpg',
                  sourceModule: 'default',
                  localizedTitle: 'Template 1',
                  description: 'Template 1 description'
                },
                {
                  name: 'template2',
                  mediaType: 'image',
                  mediaSubtype: 'jpg',
                  sourceModule: 'custom-module',
                  description: 'A custom template'
                }
              ]
            },
            {
              moduleName: 'default',
              title: 'Default',
              localizedTitle: 'Default Templates',
              templates: [
                {
                  name: 'template1',
                  mediaType: 'image',
                  mediaSubtype: 'jpg',
                  localizedTitle: 'Template 1',
                  localizedDescription: 'A default template',
                  description: 'Template 1 description'
                }
              ]
            }
          ]
        }
      ]
    } as Partial<MockWorkflowTemplatesStore> as MockWorkflowTemplatesStore

    vi.mocked(useWorkflowTemplatesStore).mockReturnValue(
      mockWorkflowTemplatesStore
    )

    // Mock fetch response
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ workflow: 'data' })
    } as Partial<Response> as Response)
  })

  it('should load templates from store', async () => {
    const { loadTemplates, isTemplatesLoaded } = useTemplateWorkflows()

    expect(isTemplatesLoaded.value).toBe(false)

    await loadTemplates()

    expect(mockWorkflowTemplatesStore.loadWorkflowTemplates).toHaveBeenCalled()
  })

  it('should select the first template category', () => {
    const { selectFirstTemplateCategory, selectedTemplate } =
      useTemplateWorkflows()

    selectFirstTemplateCategory()

    expect(selectedTemplate.value).toEqual(
      mockWorkflowTemplatesStore.groupedTemplates[0].modules[0]
    )
  })

  it('should select a template category', () => {
    const { selectTemplateCategory, selectedTemplate } = useTemplateWorkflows()
    const category = mockWorkflowTemplatesStore.groupedTemplates[0].modules[1] // Default category

    const result = selectTemplateCategory(category)

    expect(result).toBe(true)
    expect(selectedTemplate.value).toEqual(category)
  })

  it('should format template thumbnails correctly for default templates', () => {
    const { getTemplateThumbnailUrl } = useTemplateWorkflows()
    const template = {
      name: 'test-template',
      mediaSubtype: 'jpg',
      mediaType: 'image',
      description: 'Test template'
    }

    const url = getTemplateThumbnailUrl(template, 'default', '1')

    expect(url).toBe('mock-file-url/templates/test-template-1.jpg')
  })

  it('should format template thumbnails correctly for custom templates', () => {
    const { getTemplateThumbnailUrl } = useTemplateWorkflows()
    const template = {
      name: 'test-template',
      mediaSubtype: 'jpg',
      mediaType: 'image',
      description: 'Test template'
    }

    const url = getTemplateThumbnailUrl(template, 'custom-module')

    expect(url).toBe(
      'mock-api-url/workflow_templates/custom-module/test-template.jpg'
    )
  })

  it('should format template titles correctly', () => {
    const { getTemplateTitle } = useTemplateWorkflows()

    // Default template with localized title
    const titleWithLocalized = getTemplateTitle(
      {
        name: 'test',
        localizedTitle: 'Localized Title',
        mediaType: 'image',
        mediaSubtype: 'jpg',
        description: 'Test'
      },
      'default'
    )
    expect(titleWithLocalized).toBe('Localized Title')

    // Default template without localized title
    const titleWithFallback = getTemplateTitle(
      {
        name: 'test',
        title: 'Title',
        mediaType: 'image',
        mediaSubtype: 'jpg',
        description: 'Test'
      },
      'default'
    )
    expect(titleWithFallback).toBe('Title')

    // Custom template
    const customTitle = getTemplateTitle(
      {
        name: 'test-template',
        title: 'Custom Title',
        mediaType: 'image',
        mediaSubtype: 'jpg',
        description: 'Test'
      },
      'custom-module'
    )
    expect(customTitle).toBe('Custom Title')

    // Fallback to name
    const nameOnly = getTemplateTitle(
      {
        name: 'name-only',
        mediaType: 'image',
        mediaSubtype: 'jpg',
        description: 'Test'
      },
      'custom-module'
    )
    expect(nameOnly).toBe('name-only')
  })

  it('should format template descriptions correctly', () => {
    const { getTemplateDescription } = useTemplateWorkflows()

    // Default template with localized description
    const descWithLocalized = getTemplateDescription({
      name: 'test',
      localizedDescription: 'Localized Description',
      mediaType: 'image',
      mediaSubtype: 'jpg',
      description: 'Test'
    })
    expect(descWithLocalized).toBe('Localized Description')

    // Custom template with description
    const customDesc = getTemplateDescription({
      name: 'test',
      description: 'custom-template_description',
      mediaType: 'image',
      mediaSubtype: 'jpg'
    })
    expect(customDesc).toBe('custom template description')
  })

  it('should load a template from the "All" category', async () => {
    const { loadWorkflowTemplate, loadingTemplateId } = useTemplateWorkflows()

    // Set the store as loaded
    mockWorkflowTemplatesStore.isLoaded = true

    // Load a template from the "All" category
    const result = await loadWorkflowTemplate('template1', 'all')
    await flushPromises()

    expect(result).toBe(true)
    expect(fetch).toHaveBeenCalledWith('mock-file-url/templates/template1.json')
    expect(loadingTemplateId.value).toBe(null) // Should reset after loading
  })

  it('should load a template from a regular category', async () => {
    const { loadWorkflowTemplate } = useTemplateWorkflows()

    // Set the store as loaded
    mockWorkflowTemplatesStore.isLoaded = true

    // Load a template from the default category
    const result = await loadWorkflowTemplate('template1', 'default')
    await flushPromises()

    expect(result).toBe(true)
    expect(fetch).toHaveBeenCalledWith('mock-file-url/templates/template1.json')
  })

  it('seeds a result into the template before loading the workflow', async () => {
    const { loadWorkflowTemplate } = useTemplateWorkflows()
    mockWorkflowTemplatesStore.isLoaded = true
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        nodes: [
          {
            id: 2,
            type: 'LoadImage',
            widgets_values: ['starter.png', 'image']
          }
        ]
      })
    } as Partial<Response> as Response)

    const result = await loadWorkflowTemplate('template1', 'default', {
      input: {
        filename: 'first-output.png',
        subfolder: 'tour',
        type: 'output'
      }
    })

    expect(result).toBe(true)
    expect(app.loadGraphData).toHaveBeenCalledWith(
      {
        nodes: [
          {
            id: 2,
            type: 'LoadImage',
            widgets_values: ['tour/first-output.png [output]', 'image']
          }
        ]
      },
      true,
      true,
      'template1',
      { openSource: 'template' }
    )
    expect(mockCaptureException).not.toHaveBeenCalled()
    expect(mockAddError).not.toHaveBeenCalled()
  })

  it('tracks template telemetry on load in cloud builds', async () => {
    const { loadWorkflowTemplate } = useTemplateWorkflows()

    mockWorkflowTemplatesStore.isLoaded = true
    await loadWorkflowTemplate('template1', 'default')
    await flushPromises()

    expect(mockTrackTemplate).toHaveBeenCalledWith({
      workflow_name: 'template1',
      template_source: 'default'
    })
  })

  it('does not fire template telemetry in OSS builds', async () => {
    mockIsCloud.value = false
    const { loadWorkflowTemplate } = useTemplateWorkflows()

    mockWorkflowTemplatesStore.isLoaded = true
    await loadWorkflowTemplate('template1', 'default')
    await flushPromises()

    expect(mockTrackTemplate).not.toHaveBeenCalled()
  })

  const enhancedTemplate = (isPartnerNode: boolean, name = 'template1') => {
    type EnhancedTemplateLike =
      MockWorkflowTemplatesStore['enhancedTemplates'][number]
    return {
      name,
      sourceModule: 'default',
      isPartnerNode
    } as Partial<EnhancedTemplateLike> as EnhancedTemplateLike
  }

  it('requests the partner education card when a paid template loads locally', async () => {
    const { loadWorkflowTemplate } = useTemplateWorkflows()
    mockWorkflowTemplatesStore.isLoaded = true
    mockWorkflowTemplatesStore.enhancedTemplates.push(enhancedTemplate(true))

    await loadWorkflowTemplate('template1', 'default')

    expect(mockRequestCard).toHaveBeenCalledWith('loaded-template')
  })

  it('retires the card instead of requesting it when no workflow was activated', async () => {
    const { loadWorkflowTemplate } = useTemplateWorkflows()
    mockWorkflowTemplatesStore.isLoaded = true
    mockWorkflowTemplatesStore.enhancedTemplates.push(enhancedTemplate(true))
    mockLoadedWorkflow.value = undefined

    await loadWorkflowTemplate('template1', 'default')

    expect(mockRequestCard).not.toHaveBeenCalled()
    expect(mockDismissCard).toHaveBeenCalled()
  })

  it('binds to the workflow this load activated, resolved by loadGraphData', async () => {
    const { loadWorkflowTemplate } = useTemplateWorkflows()
    mockWorkflowTemplatesStore.isLoaded = true
    mockWorkflowTemplatesStore.enhancedTemplates.push(enhancedTemplate(true))

    // loadGraphData resolves to the workflow it activated even if the user has
    // since switched tabs during its asset-scan window, so the card binds to
    // that workflow rather than whichever one is globally active now.
    mockLoadedWorkflow.value = { key: 'template-a' }

    await loadWorkflowTemplate('template1', 'default')

    expect(mockRequestCard).toHaveBeenCalledWith('template-a')
  })

  it('does not request the education card for open-source templates', async () => {
    const { loadWorkflowTemplate } = useTemplateWorkflows()
    mockWorkflowTemplatesStore.isLoaded = true
    mockWorkflowTemplatesStore.enhancedTemplates.push(enhancedTemplate(false))

    await loadWorkflowTemplate('template1', 'default')

    expect(mockRequestCard).not.toHaveBeenCalled()
  })

  it('retires an earlier request when an open-source template loads next', async () => {
    const { loadWorkflowTemplate } = useTemplateWorkflows()
    mockWorkflowTemplatesStore.isLoaded = true
    mockWorkflowTemplatesStore.enhancedTemplates.push(
      enhancedTemplate(true),
      enhancedTemplate(false, 'template2')
    )

    await loadWorkflowTemplate('template1', 'default')
    expect(mockRequestCard).toHaveBeenCalledTimes(1)

    // The open-source template may still contain partner nodes, so the card
    // would otherwise linger and describe the wrong template.
    await loadWorkflowTemplate('template2', 'default')
    expect(mockDismissCard).toHaveBeenCalledTimes(1)
  })

  it('should handle errors when loading templates', async () => {
    const { loadWorkflowTemplate, loadingTemplateId } = useTemplateWorkflows()

    // Set the store as loaded
    mockWorkflowTemplatesStore.isLoaded = true

    // Mock fetch to throw an error
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Failed to fetch'))

    // Load a template that will fail
    const result = await loadWorkflowTemplate('error-template', 'default')

    expect(result).toBe(false)
    expectReportedFailure(new Error('Failed to fetch'), {
      errorType: 'error_loading_workflow_template',
      tags: {
        failure_category: 'template_loading',
        failure_reason: 'load_failed'
      },
      context: { templateId: 'error-template', sourceModule: 'default' }
    })
    expect(app.loadGraphData).not.toHaveBeenCalled()
    expect(mockCloseDialog).not.toHaveBeenCalled()
    expect(loadingTemplateId.value).toBe(null) // Should reset even after error
  })

  it.for([
    {
      catalogLoaded: false,
      sourceModule: 'default',
      error: 'Template catalog is unavailable',
      errorType: 'error_loading_workflow_template',
      category: 'template_loading',
      reason: 'catalog_unavailable'
    },
    {
      catalogLoaded: true,
      sourceModule: 'all',
      error: 'Template source metadata is unavailable',
      errorType: 'error_transforming_workflow_template',
      category: 'template_metadata',
      reason: 'source_module_unavailable'
    }
  ])('reports unavailable template prerequisites: $reason', async (failure) => {
    const { loadWorkflowTemplate, loadingTemplateId } = useTemplateWorkflows()
    mockWorkflowTemplatesStore.isLoaded = failure.catalogLoaded

    expect(
      await loadWorkflowTemplate('missing-template', failure.sourceModule)
    ).toBe(false)
    expectReportedFailure(new Error(failure.error), {
      errorType: failure.errorType,
      tags: {
        failure_category: failure.category,
        failure_reason: failure.reason
      },
      context: {
        templateId: 'missing-template',
        sourceModule: failure.sourceModule
      }
    })
    expect(fetch).not.toHaveBeenCalled()
    expect(app.loadGraphData).not.toHaveBeenCalled()
    expect(mockCloseDialog).not.toHaveBeenCalled()
    expect(loadingTemplateId.value).toBeNull()
  })

  it('reports a failed template response without parsing or loading it', async () => {
    const { loadWorkflowTemplate, loadingTemplateId } = useTemplateWorkflows()
    mockWorkflowTemplatesStore.isLoaded = true
    const json = vi.fn()
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json
    } as Partial<Response> as Response)

    expect(await loadWorkflowTemplate('template1', 'default')).toBe(false)
    expectReportedFailure(new Error('Template response failed (404)'), {
      errorType: 'error_loading_workflow_template_response',
      tags: {
        failure_category: 'template_loading',
        failure_reason: 'http_response'
      },
      context: {
        templateId: 'template1',
        sourceModule: 'default',
        status: 404
      }
    })
    expect(json).not.toHaveBeenCalled()
    expect(app.loadGraphData).not.toHaveBeenCalled()
    expect(mockCloseDialog).not.toHaveBeenCalled()
    expect(mockTrackTemplate).not.toHaveBeenCalled()
    expect(loadingTemplateId.value).toBeNull()
  })

  it.for([
    {
      nodes: [
        { id: 2, type: 'LoadImage', widgets_values: { upload: 'image' } }
      ],
      error: 'LoadImage has no serialized image widget',
      category: 'semantic_binding',
      reason: 'widget_value_missing'
    },
    {
      nodes: undefined,
      error: 'Template workflow has invalid nodes',
      category: 'template_metadata',
      reason: 'invalid_workflow'
    }
  ])(
    'reports invalid template data and preserves the active graph: $error',
    async ({ nodes, error, category, reason }) => {
      const { loadWorkflowTemplate, loadingTemplateId } = useTemplateWorkflows()
      mockWorkflowTemplatesStore.isLoaded = true
      const workflow = { nodes }
      const before = structuredClone(workflow)
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(workflow)
      } as Partial<Response> as Response)

      expect(
        await loadWorkflowTemplate('template1', 'default', {
          input: { filename: 'output.png' }
        })
      ).toBe(false)
      expectReportedFailure(new Error(error), {
        errorType: 'error_transforming_workflow_template',
        tags: { failure_category: category, failure_reason: reason },
        context: { templateId: 'template1', sourceModule: 'default' }
      })
      expect(app.loadGraphData).not.toHaveBeenCalled()
      expect(mockCloseDialog).not.toHaveBeenCalled()
      expect(mockTrackTemplate).not.toHaveBeenCalled()
      expect(workflow).toEqual(before)
      expect(loadingTemplateId.value).toBeNull()
    }
  )

  it('reports missing input metadata without loading an unseeded workflow', async () => {
    const { loadWorkflowTemplate, loadingTemplateId } = useTemplateWorkflows()
    mockWorkflowTemplatesStore.isLoaded = true
    vi.mocked(mockWorkflowTemplatesStore.getTemplateByName).mockReturnValueOnce(
      undefined
    )

    expect(
      await loadWorkflowTemplate('template1', 'default', {
        input: { filename: 'output.png' }
      })
    ).toBe(false)
    expectReportedFailure(new Error('Template input metadata is unavailable'), {
      errorType: 'error_transforming_workflow_template',
      tags: {
        failure_category: 'template_metadata',
        failure_reason: 'input_metadata_unavailable'
      },
      context: { templateId: 'template1', sourceModule: 'default' }
    })
    expect(app.loadGraphData).not.toHaveBeenCalled()
    expect(mockCloseDialog).not.toHaveBeenCalled()
    expect(loadingTemplateId.value).toBeNull()
  })
})
