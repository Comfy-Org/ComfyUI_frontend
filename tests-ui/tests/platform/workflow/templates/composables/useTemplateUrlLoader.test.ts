import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTemplateUrlLoader } from '@/platform/workflow/templates/composables/useTemplateUrlLoader'

/**
 * Unit tests for useTemplateUrlLoader composable
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
      if (key === 'g.errorLoadingTemplate') return 'Failed to load template'
      return key
    })
  })
}))

describe('useTemplateUrlLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQueryParams = {}
  })

  it('does not load template when no query param present', () => {
    mockQueryParams = {}

    const { loadTemplateFromUrl } = useTemplateUrlLoader()
    void loadTemplateFromUrl()

    expect(mockLoadTemplates).not.toHaveBeenCalled()
    expect(mockLoadWorkflowTemplate).not.toHaveBeenCalled()
  })

  it('loads template when query param is present', async () => {
    mockQueryParams = { template: 'flux_simple' }

    const { loadTemplateFromUrl } = useTemplateUrlLoader()
    await loadTemplateFromUrl()

    expect(mockLoadTemplates).toHaveBeenCalledTimes(1)
    expect(mockLoadWorkflowTemplate).toHaveBeenCalledWith(
      'flux_simple',
      'default'
    )
  })

  it('uses default source when source param is not provided', async () => {
    mockQueryParams = { template: 'flux_simple' }

    const { loadTemplateFromUrl } = useTemplateUrlLoader()
    await loadTemplateFromUrl()

    expect(mockLoadWorkflowTemplate).toHaveBeenCalledWith(
      'flux_simple',
      'default'
    )
  })

  it('uses custom source when source param is provided', async () => {
    mockQueryParams = { template: 'custom-template', source: 'custom-module' }

    const { loadTemplateFromUrl } = useTemplateUrlLoader()
    await loadTemplateFromUrl()

    expect(mockLoadWorkflowTemplate).toHaveBeenCalledWith(
      'custom-template',
      'custom-module'
    )
  })

  it('shows error toast when template loading fails', async () => {
    mockQueryParams = { template: 'invalid-template' }
    mockLoadWorkflowTemplate.mockResolvedValueOnce(false)

    const { loadTemplateFromUrl } = useTemplateUrlLoader()
    await loadTemplateFromUrl()

    expect(mockToastAdd).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'Error',
      detail: 'Template "invalid-template" not found',
      life: 3000
    })
  })

  it('handles array query params correctly', () => {
    // Vue Router can return string[] for duplicate params
    mockQueryParams = { template: ['first', 'second'] as any }

    const { loadTemplateFromUrl } = useTemplateUrlLoader()
    void loadTemplateFromUrl()

    // Should not load when param is an array
    expect(mockLoadTemplates).not.toHaveBeenCalled()
  })

  it('rejects invalid template parameter with special characters', () => {
    // Test path traversal attempt
    mockQueryParams = { template: '../../../etc/passwd' }

    const { loadTemplateFromUrl } = useTemplateUrlLoader()
    void loadTemplateFromUrl()

    // Should not load invalid template
    expect(mockLoadTemplates).not.toHaveBeenCalled()
  })

  it('rejects invalid template parameter with slash', () => {
    mockQueryParams = { template: 'path/to/template' }

    const { loadTemplateFromUrl } = useTemplateUrlLoader()
    void loadTemplateFromUrl()

    // Should not load invalid template
    expect(mockLoadTemplates).not.toHaveBeenCalled()
  })

  it('accepts valid template parameter formats', async () => {
    const validTemplates = [
      'flux_simple',
      'flux-kontext-dev',
      'template123',
      'My_Template-2'
    ]

    for (const template of validTemplates) {
      vi.clearAllMocks()
      mockQueryParams = { template }

      const { loadTemplateFromUrl } = useTemplateUrlLoader()
      await loadTemplateFromUrl()

      expect(mockLoadWorkflowTemplate).toHaveBeenCalledWith(template, 'default')
    }
  })

  it('rejects invalid source parameter with special characters', () => {
    mockQueryParams = { template: 'flux_simple', source: '../malicious' }

    const { loadTemplateFromUrl } = useTemplateUrlLoader()
    void loadTemplateFromUrl()

    // Should not load with invalid source
    expect(mockLoadTemplates).not.toHaveBeenCalled()
  })

  it('accepts valid source parameter formats', async () => {
    const validSources = ['default', 'custom-module', 'my_source', 'source123']

    for (const source of validSources) {
      vi.clearAllMocks()
      mockQueryParams = { template: 'flux_simple', source }

      const { loadTemplateFromUrl } = useTemplateUrlLoader()
      await loadTemplateFromUrl()

      expect(mockLoadWorkflowTemplate).toHaveBeenCalledWith(
        'flux_simple',
        source
      )
    }
  })

  it('shows error toast when exception is thrown', async () => {
    mockQueryParams = { template: 'flux_simple' }
    mockLoadTemplates.mockRejectedValueOnce(new Error('Network error'))

    const { loadTemplateFromUrl } = useTemplateUrlLoader()
    await loadTemplateFromUrl()

    expect(mockToastAdd).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to load template',
      life: 3000
    })
  })
})
