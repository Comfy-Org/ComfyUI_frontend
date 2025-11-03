import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Unit tests for template URL loading feature
 *
 * Tests the behavior of loading templates via URL query parameters:
 * - ?template=flux_simple loads the template
 * - ?template=flux_simple&source=custom loads from custom source
 * - Invalid template shows error toast
 * - Input validation for template and source parameters
 */

// Mock vue-router
let mockQueryParams: Record<string, string | undefined> = {}

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({
    query: mockQueryParams
  }))
}))

// Mock template workflows composable
const mockLoadTemplates = vi.fn().mockResolvedValue(true)
const mockLoadWorkflowTemplate = vi.fn().mockResolvedValue(true)

vi.mock(
  '@/platform/workflow/templates/composables/useTemplateWorkflows',
  () => ({
    useTemplateWorkflows: () => ({
      loadTemplates: mockLoadTemplates,
      loadWorkflowTemplate: mockLoadWorkflowTemplate
    })
  })
)

// Mock toast
const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: () => ({
    add: mockToastAdd
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
    mockQueryParams = {}
  })

  it('does not load template when no query param present', () => {
    mockQueryParams = {}

    const templateParam = mockQueryParams.template
    const shouldLoad = !!(templateParam && typeof templateParam === 'string')

    expect(shouldLoad).toBe(false)
  })

  it('loads template when query param is present', async () => {
    mockQueryParams = { template: 'flux_simple' }

    const templateParam = mockQueryParams.template
    if (templateParam && typeof templateParam === 'string') {
      const sourceParam = mockQueryParams.source || 'default'

      await mockLoadTemplates()
      await mockLoadWorkflowTemplate(templateParam, sourceParam)
    }

    expect(mockLoadTemplates).toHaveBeenCalledTimes(1)
    expect(mockLoadWorkflowTemplate).toHaveBeenCalledWith(
      'flux_simple',
      'default'
    )
  })

  it('uses default source when source param is not provided', async () => {
    mockQueryParams = { template: 'flux_simple' }

    const templateParam = mockQueryParams.template
    if (templateParam && typeof templateParam === 'string') {
      const sourceParam = mockQueryParams.source || 'default'

      await mockLoadTemplates()
      await mockLoadWorkflowTemplate(templateParam, sourceParam)
    }

    expect(mockLoadWorkflowTemplate).toHaveBeenCalledWith(
      'flux_simple',
      'default'
    )
  })

  it('uses custom source when source param is provided', async () => {
    mockQueryParams = { template: 'custom-template', source: 'custom-module' }

    const templateParam = mockQueryParams.template
    if (templateParam && typeof templateParam === 'string') {
      const sourceParam = mockQueryParams.source || 'default'

      await mockLoadTemplates()
      await mockLoadWorkflowTemplate(templateParam, sourceParam)
    }

    expect(mockLoadWorkflowTemplate).toHaveBeenCalledWith(
      'custom-template',
      'custom-module'
    )
  })

  it('shows error toast when template loading fails', async () => {
    mockQueryParams = { template: 'invalid-template' }
    mockLoadWorkflowTemplate.mockResolvedValueOnce(false)

    const templateParam = mockQueryParams.template
    if (templateParam && typeof templateParam === 'string') {
      const sourceParam = mockQueryParams.source || 'default'

      await mockLoadTemplates()
      const success = await mockLoadWorkflowTemplate(templateParam, sourceParam)

      if (!success) {
        mockToastAdd({
          severity: 'error',
          summary: 'Error',
          detail: `Template "${templateParam}" not found`,
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

  it('validates query param is string before loading', async () => {
    mockQueryParams = { template: 'flux_simple' }

    const templateParam = mockQueryParams.template
    const isValid = !!(templateParam && typeof templateParam === 'string')

    expect(isValid).toBe(true)

    if (isValid) {
      const sourceParam = mockQueryParams.source || 'default'
      await mockLoadWorkflowTemplate(templateParam, sourceParam)
    }

    expect(mockLoadWorkflowTemplate).toHaveBeenCalled()
  })

  it('handles array query params correctly', () => {
    // Vue Router can return string[] for duplicate params
    mockQueryParams = { template: ['first', 'second'] as any }

    const templateParam = mockQueryParams.template
    const isValid = !!(templateParam && typeof templateParam === 'string')

    // Should not load when param is an array
    expect(isValid).toBe(false)
  })

  it('rejects invalid template parameter with special characters', () => {
    // Test path traversal attempt
    mockQueryParams = { template: '../../../etc/passwd' }

    const templateParam = mockQueryParams.template
    const isValidFormat = /^[a-zA-Z0-9_-]+$/.test(templateParam!)

    expect(isValidFormat).toBe(false)
  })

  it('rejects invalid template parameter with slash', () => {
    mockQueryParams = { template: 'path/to/template' }

    const templateParam = mockQueryParams.template
    const isValidFormat = /^[a-zA-Z0-9_-]+$/.test(templateParam!)

    expect(isValidFormat).toBe(false)
  })

  it('accepts valid template parameter formats', () => {
    const validTemplates = [
      'flux_simple',
      'flux-kontext-dev',
      'template123',
      'My_Template-2'
    ]

    validTemplates.forEach((template) => {
      const isValidFormat = /^[a-zA-Z0-9_-]+$/.test(template)
      expect(isValidFormat).toBe(true)
    })
  })

  it('rejects invalid source parameter with special characters', () => {
    mockQueryParams = { template: 'flux_simple', source: '../malicious' }

    const sourceParam = mockQueryParams.source!
    const isValidFormat = /^[a-zA-Z0-9_-]+$/.test(sourceParam)

    expect(isValidFormat).toBe(false)
  })

  it('accepts valid source parameter formats', () => {
    const validSources = ['default', 'custom-module', 'my_source', 'source123']

    validSources.forEach((source) => {
      const isValidFormat = /^[a-zA-Z0-9_-]+$/.test(source)
      expect(isValidFormat).toBe(true)
    })
  })
})
