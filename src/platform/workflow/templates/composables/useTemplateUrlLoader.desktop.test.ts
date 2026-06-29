import { describe, expect, it, vi } from 'vitest'

import { useTemplateUrlLoader } from '@/platform/workflow/templates/composables/useTemplateUrlLoader'

vi.mock('@/platform/distribution/types', () => ({
  isDesktop: true
}))

let mockQueryParams: Record<string, string | string[] | undefined> = {}

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({ query: mockQueryParams })),
  useRouter: vi.fn(() => ({ replace: vi.fn() }))
}))

vi.mock('@/platform/navigation/preservedQueryManager', () => ({
  clearPreservedQuery: vi.fn()
}))

const mockLoadWorkflowTemplate = vi.fn().mockResolvedValue(true)

vi.mock(
  '@/platform/workflow/templates/composables/useTemplateWorkflows',
  () => ({
    useTemplateWorkflows: () => ({
      loadTemplates: vi.fn().mockResolvedValue(true),
      loadWorkflowTemplate: mockLoadWorkflowTemplate
    })
  })
)

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: vi.fn() })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: vi.fn((key: string) => key) })
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({ linearMode: false })
}))

describe('useTemplateUrlLoader (desktop)', () => {
  it('tags a URL template open as starter_template on desktop', async () => {
    mockQueryParams = { template: 'flux_simple' }

    const { loadTemplateFromUrl } = useTemplateUrlLoader()
    await loadTemplateFromUrl()

    expect(mockLoadWorkflowTemplate).toHaveBeenCalledWith(
      'flux_simple',
      'default',
      'starter_template'
    )
  })
})
