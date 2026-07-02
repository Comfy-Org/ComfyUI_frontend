import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTemplateWorkflows } from '@/platform/workflow/templates/composables/useTemplateWorkflows'
import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'

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

// Mock the dialog store
vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: vi.fn(() => ({
    closeDialog: vi.fn()
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

// Mock fetch
global.fetch = vi.fn()

type MockWorkflowTemplatesStore = ReturnType<typeof useWorkflowTemplatesStore>

describe('useTemplateWorkflows', () => {
  let mockWorkflowTemplatesStore: MockWorkflowTemplatesStore

  beforeEach(() => {
    mockIsCloud.value = true
    mockTrackTemplate.mockClear()

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
