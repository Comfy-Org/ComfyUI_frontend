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
  normalizeShareableAssetsResponse: (r: unknown) => r,
  useWorkflowShareService: () => ({
    getSharedWorkflow: mockGetSharedWorkflow
  })
}))

const mockLoadGraphData = vi.hoisted(() => vi.fn())
const mockGraphToPrompt = vi.hoisted(() => vi.fn())

vi.mock('@/scripts/app', () => ({
  app: {
    loadGraphData: mockLoadGraphData,
    graphToPrompt: mockGraphToPrompt
  }
}))

const mockGetShareableAssets = vi.hoisted(() => vi.fn())

vi.mock('@/scripts/api', () => ({
  api: {
    getShareableAssets: mockGetShareableAssets
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
      if (key === 'openSharedWorkflow.dialogTitle') {
        return 'Open shared workflow'
      }
      if (key === 'openSharedWorkflow.importFailed') {
        return 'Failed to import workflow assets'
      }
      return key
    })
  })
}))

const mockShowLayoutDialog = vi.hoisted(() => vi.fn())
const mockCloseDialog = vi.hoisted(() => vi.fn())

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    showLayoutDialog: mockShowLayoutDialog
  })
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({
    closeDialog: mockCloseDialog
  })
}))

function resolveDialog(confirmed: boolean) {
  const call = mockShowLayoutDialog.mock.calls.at(-1)
  if (!call) throw new Error('showLayoutDialog was not called')
  const options = call[0]
  if (confirmed) {
    options.props.onConfirm()
  } else {
    options.props.onCancel()
  }
}

function makeSharedWorkflow(overrides: Record<string, unknown> = {}) {
  return {
    shareId: 'share-id-1',
    workflowId: 'workflow-id-1',
    listed: true,
    publishedAt: new Date('2026-02-20T00:00:00Z'),
    workflowJson: { nodes: [] },
    importedAssets: [],
    ...overrides
  }
}

describe('useSharedWorkflowUrlLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQueryParams = {}
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue(null)
    mockGraphToPrompt.mockResolvedValue({ output: {} })
    mockGetShareableAssets.mockResolvedValue({ assets: [], models: [] })
  })

  it('does nothing when no share query param is present', async () => {
    const { loadSharedWorkflowFromUrl } = useSharedWorkflowUrlLoader()

    const loaded = await loadSharedWorkflowFromUrl()

    expect(loaded).toBe('not-present')
    expect(mockGetSharedWorkflow).not.toHaveBeenCalled()
    expect(mockLoadGraphData).not.toHaveBeenCalled()
  })

  it('loads shared workflow and shows confirmation dialog', async () => {
    mockQueryParams = { share: 'share-id-1' }
    mockGetSharedWorkflow.mockResolvedValue(makeSharedWorkflow())
    mockShowLayoutDialog.mockImplementation(() => {
      resolveDialog(true)
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
    expect(mockShowLayoutDialog).toHaveBeenCalled()
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'share'
    )
  })

  it('does not call import when no non-owned assets exist', async () => {
    mockQueryParams = { share: 'share-id-1' }
    mockGetSharedWorkflow.mockResolvedValue(makeSharedWorkflow())
    mockGetShareableAssets.mockResolvedValue({ assets: [], models: [] })
    mockShowLayoutDialog.mockImplementation(() => {
      resolveDialog(true)
    })

    const { loadSharedWorkflowFromUrl } = useSharedWorkflowUrlLoader()
    await loadSharedWorkflowFromUrl()

    expect(mockGetSharedWorkflow).toHaveBeenCalledTimes(1)
    expect(mockGetSharedWorkflow).toHaveBeenCalledWith('share-id-1')
  })

  it('calls import when non-owned assets exist and user confirms', async () => {
    mockQueryParams = { share: 'share-id-1' }
    mockGetSharedWorkflow.mockResolvedValue(makeSharedWorkflow())
    mockGetShareableAssets.mockResolvedValue({
      assets: [{ id: 'a1', name: 'img.png' }],
      models: []
    })
    mockShowLayoutDialog.mockImplementation(() => {
      resolveDialog(true)
    })

    const { loadSharedWorkflowFromUrl } = useSharedWorkflowUrlLoader()
    await loadSharedWorkflowFromUrl()

    expect(mockGetSharedWorkflow).toHaveBeenCalledTimes(2)
    expect(mockGetSharedWorkflow).toHaveBeenNthCalledWith(1, 'share-id-1')
    expect(mockGetSharedWorkflow).toHaveBeenNthCalledWith(2, 'share-id-1', {
      import: true
    })
  })

  it('does not call import when user declines dialog', async () => {
    mockQueryParams = { share: 'share-id-1' }
    mockGetSharedWorkflow.mockResolvedValue(makeSharedWorkflow())
    mockGetShareableAssets.mockResolvedValue({
      assets: [{ id: 'a1', name: 'img.png' }],
      models: []
    })
    mockShowLayoutDialog.mockImplementation(() => {
      resolveDialog(false)
    })

    const { loadSharedWorkflowFromUrl } = useSharedWorkflowUrlLoader()
    await loadSharedWorkflowFromUrl()

    expect(mockGetSharedWorkflow).toHaveBeenCalledTimes(1)
  })

  it('shows toast on import failure but still returns loaded', async () => {
    mockQueryParams = { share: 'share-id-1' }
    mockGetSharedWorkflow
      .mockResolvedValueOnce(makeSharedWorkflow())
      .mockRejectedValueOnce(new Error('Import failed'))
    mockGetShareableAssets.mockResolvedValue({
      assets: [],
      models: [{ id: 'm1', name: 'model.safetensors' }]
    })
    mockShowLayoutDialog.mockImplementation(() => {
      resolveDialog(true)
    })

    const { loadSharedWorkflowFromUrl } = useSharedWorkflowUrlLoader()
    const loaded = await loadSharedWorkflowFromUrl()

    expect(loaded).toBe('loaded')
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        detail: 'Failed to import workflow assets'
      })
    )
  })

  it('passes non-owned assets to dialog props', async () => {
    mockQueryParams = { share: 'share-id-1' }
    mockGetSharedWorkflow.mockResolvedValue(makeSharedWorkflow())
    const nonOwnedAssets = {
      assets: [{ id: 'a1', name: 'photo.png' }],
      models: [{ id: 'm1', name: 'lora.safetensors' }]
    }
    mockGetShareableAssets.mockResolvedValue(nonOwnedAssets)
    mockShowLayoutDialog.mockImplementation(() => {
      resolveDialog(true)
    })

    const { loadSharedWorkflowFromUrl } = useSharedWorkflowUrlLoader()
    await loadSharedWorkflowFromUrl()

    const dialogCall = mockShowLayoutDialog.mock.calls[0][0]
    expect(dialogCall.props.assets).toEqual(nonOwnedAssets.assets)
    expect(dialogCall.props.models).toEqual(nonOwnedAssets.models)
  })

  it('calls getShareableAssets with owned:false', async () => {
    mockQueryParams = { share: 'share-id-1' }
    mockGetSharedWorkflow.mockResolvedValue(makeSharedWorkflow())
    mockGraphToPrompt.mockResolvedValue({ output: { '1': {} } })
    mockShowLayoutDialog.mockImplementation(() => {
      resolveDialog(true)
    })

    const { loadSharedWorkflowFromUrl } = useSharedWorkflowUrlLoader()
    await loadSharedWorkflowFromUrl()

    expect(mockGetShareableAssets).toHaveBeenCalledWith(
      { '1': {} },
      {
        owned: false
      }
    )
  })

  it('restores preserved share query before loading', async () => {
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue({
      share: 'preserved-share-id'
    })
    mockGetSharedWorkflow.mockResolvedValue(
      makeSharedWorkflow({ shareId: 'preserved-share-id' })
    )
    mockShowLayoutDialog.mockImplementation(() => {
      resolveDialog(true)
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

  it('still shows dialog when asset discovery fails', async () => {
    mockQueryParams = { share: 'share-id-1' }
    mockGetSharedWorkflow.mockResolvedValue(makeSharedWorkflow())
    mockGraphToPrompt.mockRejectedValue(new Error('prompt fail'))
    mockShowLayoutDialog.mockImplementation(() => {
      resolveDialog(true)
    })

    const { loadSharedWorkflowFromUrl } = useSharedWorkflowUrlLoader()
    const loaded = await loadSharedWorkflowFromUrl()

    expect(loaded).toBe('loaded')
    expect(mockShowLayoutDialog).toHaveBeenCalled()
    const dialogCall = mockShowLayoutDialog.mock.calls[0][0]
    expect(dialogCall.props.assets).toEqual([])
    expect(dialogCall.props.models).toEqual([])
  })

  it('extracts workflow name from workflowJson', async () => {
    mockQueryParams = { share: 'share-id-1' }
    mockGetSharedWorkflow.mockResolvedValue(
      makeSharedWorkflow({
        workflowJson: { nodes: [], name: 'My Custom Workflow' }
      })
    )
    mockShowLayoutDialog.mockImplementation(() => {
      resolveDialog(true)
    })

    const { loadSharedWorkflowFromUrl } = useSharedWorkflowUrlLoader()
    await loadSharedWorkflowFromUrl()

    const dialogCall = mockShowLayoutDialog.mock.calls[0][0]
    expect(dialogCall.props.workflowName).toBe('My Custom Workflow')
  })
})
