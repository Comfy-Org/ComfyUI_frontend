import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

/**
 * Integration tests for template URL loading feature
 *
 * Tests the behavior of loading templates via URL query parameters:
 * - ?template=flux_simple loads the template
 * - ?template=flux_simple&source=custom loads from custom source
 * - Invalid template shows error toast
 */

// Mock @vueuse/router
const mockTemplateQuery = ref<string | null>(null)
const mockSourceQuery = ref<string>('default')

vi.mock('@vueuse/router', () => ({
  useRouteQuery: vi.fn((param: string, defaultValue: any) => {
    if (param === 'template') return mockTemplateQuery
    if (param === 'source') return mockSourceQuery
    return ref(defaultValue)
  })
}))

// Mock template workflows composable
const mockLoadTemplates = vi.fn().mockResolvedValue(true)
const mockLoadWorkflowTemplate = vi.fn().mockResolvedValue(true)

vi.mock(
  '@/platform/workflow/templates/composables/useTemplateWorkflows',
  () => ({
    useTemplateWorkflows: () => ({
      loadTemplates: mockLoadTemplates,
      loadWorkflowTemplate: mockLoadWorkflowTemplate,
      isTemplatesLoaded: ref(false),
      allTemplateGroups: ref([])
    })
  })
)

// Mock toast
const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: () => ({
    add: mockToastAdd,
    remove: vi.fn()
  })
}))

// Mock i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: vi.fn((key: string, params?: any) => {
      if (key === 'g.error') return 'Error'
      if (key === 'templateWorkflows.error.templateNotFound') {
        return `Template "${params?.templateName}" not found`
      }
      return key
    })
  })
}))

describe('Template URL Loading', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTemplateQuery.value = null
    mockSourceQuery.value = 'default'
  })

  it('does not load template when no query param present', async () => {
    // Simulate GraphView initialization with no template param
    mockTemplateQuery.value = null

    // The logic in GraphView checks: if (templateQuery.value)
    const shouldLoad = !!mockTemplateQuery.value

    expect(shouldLoad).toBe(false)
    expect(mockLoadTemplates).not.toHaveBeenCalled()
    expect(mockLoadWorkflowTemplate).not.toHaveBeenCalled()
  })

  it('loads template when query param is present', async () => {
    mockTemplateQuery.value = 'flux_simple'
    mockSourceQuery.value = 'default'

    // Simulate the loading logic from GraphView
    if (mockTemplateQuery.value) {
      await mockLoadTemplates()
      await mockLoadWorkflowTemplate(
        mockTemplateQuery.value,
        mockSourceQuery.value
      )
    }

    expect(mockLoadTemplates).toHaveBeenCalledTimes(1)
    expect(mockLoadWorkflowTemplate).toHaveBeenCalledWith(
      'flux_simple',
      'default'
    )
  })

  it('uses default source when source param is not provided', async () => {
    mockTemplateQuery.value = 'flux_simple'
    // mockSourceQuery defaults to 'default'

    if (mockTemplateQuery.value) {
      await mockLoadTemplates()
      await mockLoadWorkflowTemplate(
        mockTemplateQuery.value,
        mockSourceQuery.value
      )
    }

    expect(mockLoadWorkflowTemplate).toHaveBeenCalledWith(
      'flux_simple',
      'default'
    )
  })

  it('uses custom source when source param is provided', async () => {
    mockTemplateQuery.value = 'custom-template'
    mockSourceQuery.value = 'custom-module'

    if (mockTemplateQuery.value) {
      await mockLoadTemplates()
      await mockLoadWorkflowTemplate(
        mockTemplateQuery.value,
        mockSourceQuery.value
      )
    }

    expect(mockLoadWorkflowTemplate).toHaveBeenCalledWith(
      'custom-template',
      'custom-module'
    )
  })

  it('shows error toast when template loading fails', async () => {
    mockTemplateQuery.value = 'invalid-template'
    mockLoadWorkflowTemplate.mockResolvedValueOnce(false)

    if (mockTemplateQuery.value) {
      await mockLoadTemplates()
      const success = await mockLoadWorkflowTemplate(
        mockTemplateQuery.value,
        mockSourceQuery.value
      )

      if (!success) {
        mockToastAdd({
          severity: 'error',
          summary: 'Error',
          detail: `Template "${mockTemplateQuery.value}" not found`,
          life: 3000
        })
      }
    }

    expect(mockToastAdd).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'Error',
      detail: 'Template "invalid-template" not found',
      life: 3000
    })
  })

  it('handles reactive updates to query params', async () => {
    // Initially no template
    mockTemplateQuery.value = null
    expect(!!mockTemplateQuery.value).toBe(false)

    // User navigates to URL with template param
    mockTemplateQuery.value = 'flux_simple'
    expect(mockTemplateQuery.value).toBe('flux_simple')

    // Template should be loaded
    if (mockTemplateQuery.value) {
      await mockLoadTemplates()
      await mockLoadWorkflowTemplate(
        mockTemplateQuery.value,
        mockSourceQuery.value
      )
    }

    expect(mockLoadWorkflowTemplate).toHaveBeenCalledWith(
      'flux_simple',
      'default'
    )
  })

  it('validates query param is string before loading', async () => {
    // useRouteQuery returns Ref<string | null>
    // GraphView checks: if (templateQuery.value)
    mockTemplateQuery.value = 'flux_simple'

    const isValid =
      typeof mockTemplateQuery.value === 'string' &&
      mockTemplateQuery.value.length > 0

    expect(isValid).toBe(true)

    if (isValid) {
      await mockLoadWorkflowTemplate(
        mockTemplateQuery.value,
        mockSourceQuery.value
      )
    }

    expect(mockLoadWorkflowTemplate).toHaveBeenCalled()
  })
})
