import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTemplateWorkflows } from '@/platform/workflow/templates/composables/useTemplateWorkflows'
import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'
import { app } from '@/scripts/app'

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

// Mock the app
vi.mock('@/scripts/app', () => ({
  app: {
    loadGraphData: vi.fn()
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

const { mockCloseDialog, mockIsCloud, mockTrackTemplate } = vi.hoisted(() => ({
  mockCloseDialog: vi.fn(),
  mockIsCloud: { value: true },
  mockTrackTemplate: vi.fn()
}))

// Mock the dialog store
vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: vi.fn(() => ({
    closeDialog: mockCloseDialog
  }))
}))

// useTelemetry() returns null in OSS, a dispatcher in cloud — toggle via mockIsCloud.
vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () =>
    mockIsCloud.value ? { trackTemplate: mockTrackTemplate } : null
}))

// Mock fetch
global.fetch = vi.fn()

type MockWorkflowTemplatesStore = ReturnType<typeof useWorkflowTemplatesStore>

const mockWorkflow = {
  version: 0.4,
  last_node_id: 0,
  last_link_id: 0,
  nodes: [],
  links: []
}

describe('useTemplateWorkflows', () => {
  let mockWorkflowTemplatesStore: MockWorkflowTemplatesStore

  beforeEach(() => {
    mockIsCloud.value = true

    mockWorkflowTemplatesStore = {
      isLoaded: false,
      loadWorkflowTemplates: vi.fn().mockResolvedValue(true),
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
      json: vi.fn().mockResolvedValue(mockWorkflow)
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

  describe('prepared template workflow', () => {
    it('prepares workflow data without opening it', async () => {
      mockWorkflowTemplatesStore.isLoaded = true
      const { prepareWorkflowTemplate } = useTemplateWorkflows()

      const prepared = await prepareWorkflowTemplate('template1', 'default')

      expect(prepared).toEqual({
        id: 'template1',
        sourceModule: 'default',
        workflowName: 'template1',
        workflow: mockWorkflow
      })
      expect(mockTrackTemplate).not.toHaveBeenCalled()
      expect(mockCloseDialog).not.toHaveBeenCalled()
      expect(app.loadGraphData).not.toHaveBeenCalled()
    })

    it('opens prepared workflow data exactly once', async () => {
      mockWorkflowTemplatesStore.isLoaded = true
      const { openPreparedWorkflowTemplate, prepareWorkflowTemplate } =
        useTemplateWorkflows()
      const prepared = await prepareWorkflowTemplate('template1', 'default')
      expect(prepared).not.toBeNull()
      if (!prepared) throw new Error('Expected a prepared workflow')

      const result = await openPreparedWorkflowTemplate(prepared)

      expect(result).toBe(true)
      expect(mockTrackTemplate).toHaveBeenCalledOnce()
      expect(mockTrackTemplate).toHaveBeenCalledWith({
        workflow_name: 'template1',
        template_source: 'default'
      })
      expect(mockCloseDialog).toHaveBeenCalledOnce()
      expect(app.loadGraphData).toHaveBeenCalledOnce()
      expect(app.loadGraphData).toHaveBeenCalledWith(
        mockWorkflow,
        true,
        true,
        'template1',
        { openSource: 'template' }
      )
    })

    it('can leave dialog closing to its caller', async () => {
      mockWorkflowTemplatesStore.isLoaded = true
      const { openPreparedWorkflowTemplate, prepareWorkflowTemplate } =
        useTemplateWorkflows()
      const prepared = await prepareWorkflowTemplate('template1', 'default')
      expect(prepared).not.toBeNull()
      if (!prepared) throw new Error('Expected a prepared workflow')

      const result = await openPreparedWorkflowTemplate(prepared, {
        closeDialog: false
      })

      expect(result).toBe(true)
      expect(mockCloseDialog).not.toHaveBeenCalled()
      expect(app.loadGraphData).toHaveBeenCalledOnce()
    })

    it('keeps loadWorkflowTemplate as the compatible prepare-and-open path', async () => {
      mockWorkflowTemplatesStore.isLoaded = true
      const { loadWorkflowTemplate } = useTemplateWorkflows()

      const result = await loadWorkflowTemplate('template1', 'default')

      expect(result).toBe(true)
      expect(fetch).toHaveBeenCalledOnce()
      expect(mockTrackTemplate).toHaveBeenCalledOnce()
      expect(mockCloseDialog).toHaveBeenCalledOnce()
      expect(app.loadGraphData).toHaveBeenCalledOnce()
    })

    it('rejects non-successful workflow responses without opening', async () => {
      mockWorkflowTemplatesStore.isLoaded = true
      const { prepareWorkflowTemplate } = useTemplateWorkflows()
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(null, { status: 404, statusText: 'Not Found' })
      )

      await expect(
        prepareWorkflowTemplate('missing-template', 'default')
      ).rejects.toThrow()
      expect(mockTrackTemplate).not.toHaveBeenCalled()
      expect(mockCloseDialog).not.toHaveBeenCalled()
      expect(app.loadGraphData).not.toHaveBeenCalled()
    })

    it('rejects invalid workflow data without opening', async () => {
      mockWorkflowTemplatesStore.isLoaded = true
      const { prepareWorkflowTemplate } = useTemplateWorkflows()
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ workflow: 'invalid' }))
      )

      await expect(
        prepareWorkflowTemplate('invalid-template', 'default')
      ).rejects.toThrow()
      expect(mockTrackTemplate).not.toHaveBeenCalled()
      expect(mockCloseDialog).not.toHaveBeenCalled()
      expect(app.loadGraphData).not.toHaveBeenCalled()
    })
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

  it('should handle errors when loading templates', async () => {
    const { loadWorkflowTemplate, loadingTemplateId } = useTemplateWorkflows()

    // Set the store as loaded
    mockWorkflowTemplatesStore.isLoaded = true

    // Mock fetch to throw an error
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Failed to fetch'))

    // Spy on console.error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Load a template that will fail
    const result = await loadWorkflowTemplate('error-template', 'default')

    expect(result).toBe(false)
    expect(consoleSpy).toHaveBeenCalled()
    expect(loadingTemplateId.value).toBe(null) // Should reset even after error

    // Restore console.error
    consoleSpy.mockRestore()
  })
})
