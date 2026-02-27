import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSharedWorkflowUrlLoader } from '@/platform/workflow/sharing/composables/useSharedWorkflowUrlLoader'

const preservedQueryMocks = vi.hoisted(() => ({
  clearPreservedQuery: vi.fn(),
  hydratePreservedQuery: vi.fn(),
  mergePreservedQueryIntoQuery: vi.fn()
}))

vi.mock(
  '@/platform/navigation/preservedQueryManager',
  () => preservedQueryMocks
)

let mockQueryParams: Record<string, string | string[] | undefined> = {}
const mockRouterReplace = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({
    query: mockQueryParams
  })),
  useRouter: vi.fn(() => ({
    replace: mockRouterReplace
  }))
}))

const mockGetSharedWorkflow = vi.fn()
const mockSharedWorkflowErrorClass = vi.hoisted(
  () =>
    class extends Error {
      readonly isRetryable: boolean

      constructor(message: string, isRetryable: boolean) {
        super(message)
        this.name = 'SharedWorkflowLoadError'
        this.isRetryable = isRetryable
      }
    }
)

vi.mock('@/platform/workflow/sharing/services/workflowShareService', () => ({
  SharedWorkflowLoadError: mockSharedWorkflowErrorClass,
  useWorkflowShareService: () => ({
    getSharedWorkflow: mockGetSharedWorkflow
  })
}))

const mockLoadGraphData = vi.hoisted(() => vi.fn())

vi.mock('@/scripts/app', () => ({
  app: {
    loadGraphData: mockLoadGraphData
  }
}))

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: () => ({
    add: mockToastAdd
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: vi.fn((key: string) => {
      if (key === 'g.error') return 'Error'
      if (key === 'shareWorkflow.loadFailed') {
        return 'Failed to load shared workflow'
      }
      return key
    })
  })
}))

describe('useSharedWorkflowUrlLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQueryParams = {}
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue(null)
  })

  it('does nothing when no share query param is present', async () => {
    const { loadSharedWorkflowFromUrl } = useSharedWorkflowUrlLoader()

    const loaded = await loadSharedWorkflowFromUrl()

    expect(loaded).toBe('not-present')
    expect(mockGetSharedWorkflow).not.toHaveBeenCalled()
    expect(mockLoadGraphData).not.toHaveBeenCalled()
  })

  it('loads shared workflow from query parameter', async () => {
    mockQueryParams = { share: 'share-id-1' }
    mockGetSharedWorkflow.mockResolvedValue({
      shareId: 'share-id-1',
      workflowId: 'workflow-id-1',
      listed: true,
      publishedAt: new Date('2026-02-20T00:00:00Z'),
      workflowJson: { nodes: [] },
      importedAssets: []
    })

    const { loadSharedWorkflowFromUrl } = useSharedWorkflowUrlLoader()
    const loaded = await loadSharedWorkflowFromUrl()

    expect(loaded).toBe('loaded')
    expect(mockGetSharedWorkflow).toHaveBeenCalledWith('share-id-1')
    expect(mockLoadGraphData).toHaveBeenCalledWith(
      { nodes: [] },
      true,
      true,
      'share-id-1'
    )
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'share'
    )
  })

  it('restores preserved share query before loading', async () => {
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue({
      share: 'preserved-share-id'
    })
    mockGetSharedWorkflow.mockResolvedValue({
      shareId: 'preserved-share-id',
      workflowId: 'workflow-id-2',
      listed: false,
      publishedAt: new Date('2026-02-20T00:00:00Z'),
      workflowJson: { nodes: [] },
      importedAssets: []
    })

    const { loadSharedWorkflowFromUrl } = useSharedWorkflowUrlLoader()
    await loadSharedWorkflowFromUrl()

    expect(preservedQueryMocks.hydratePreservedQuery).toHaveBeenCalledWith(
      'share'
    )
    expect(mockRouterReplace).toHaveBeenCalledWith({
      query: { share: 'preserved-share-id' }
    })
    expect(mockGetSharedWorkflow).toHaveBeenCalledWith('preserved-share-id')
  })

  it('rejects invalid share parameter values', async () => {
    mockQueryParams = { share: '../../../etc/passwd' }

    const { loadSharedWorkflowFromUrl } = useSharedWorkflowUrlLoader()
    const loaded = await loadSharedWorkflowFromUrl()

    expect(loaded).toBe('failed')
    expect(mockGetSharedWorkflow).not.toHaveBeenCalled()
    expect(mockToastAdd).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to load shared workflow',
      life: 3000
    })
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'share'
    )
  })

  it('shows toast and cleans URL when loading fails', async () => {
    mockQueryParams = { share: 'missing' }
    mockGetSharedWorkflow.mockRejectedValue(new Error('Share not found'))

    const { loadSharedWorkflowFromUrl } = useSharedWorkflowUrlLoader()
    const loaded = await loadSharedWorkflowFromUrl()

    expect(loaded).toBe('failed')
    expect(mockToastAdd).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'Error',
      detail: 'Share not found',
      life: 3000
    })
    expect(mockRouterReplace).not.toHaveBeenCalledWith({ query: {} })
    expect(preservedQueryMocks.clearPreservedQuery).not.toHaveBeenCalledWith(
      'share'
    )
  })

  it('cleans URL when shared workflow load fails with non-retryable error', async () => {
    mockQueryParams = { share: 'missing' }
    mockGetSharedWorkflow.mockRejectedValue(
      new mockSharedWorkflowErrorClass(
        'Failed to load shared workflow: 404',
        false
      )
    )

    const { loadSharedWorkflowFromUrl } = useSharedWorkflowUrlLoader()
    const loaded = await loadSharedWorkflowFromUrl()

    expect(loaded).toBe('failed')
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'share'
    )
  })
})
