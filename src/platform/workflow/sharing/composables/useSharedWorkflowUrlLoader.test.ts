import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SharedWorkflowPayload } from '@/platform/workflow/sharing/types/shareTypes'
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

const mockImportPublishedAssets = vi.fn()

vi.mock('@/platform/workflow/sharing/services/workflowShareService', () => ({
  SharedWorkflowLoadError: class extends Error {
    readonly isRetryable: boolean
    constructor(message: string, isRetryable: boolean) {
      super(message)
      this.name = 'SharedWorkflowLoadError'
      this.isRetryable = isRetryable
    }
  },
  useWorkflowShareService: () => ({
    getSharedWorkflow: vi.fn(),
    importPublishedAssets: mockImportPublishedAssets
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

function makePayload(
  overrides: Partial<SharedWorkflowPayload> = {}
): SharedWorkflowPayload {
  return {
    shareId: 'share-id-1',
    workflowId: 'workflow-id-1',
    name: 'Test Workflow',
    listed: true,
    publishedAt: new Date('2026-02-20T00:00:00Z'),
    workflowJson: {
      nodes: []
    } as unknown as SharedWorkflowPayload['workflowJson'],
    assets: [],
    ...overrides
  }
}

function resolveDialogWithConfirm(payload: SharedWorkflowPayload) {
  const call = mockShowLayoutDialog.mock.calls.at(-1)
  if (!call) throw new Error('showLayoutDialog was not called')
  const options = call[0]
  options.props.onConfirm(payload)
}

function resolveDialogWithOpenOnly(payload: SharedWorkflowPayload) {
  const call = mockShowLayoutDialog.mock.calls.at(-1)
  if (!call) throw new Error('showLayoutDialog was not called')
  const options = call[0]
  options.props.onOpenWithoutImporting(payload)
}

function resolveDialogWithCancel() {
  const call = mockShowLayoutDialog.mock.calls.at(-1)
  if (!call) throw new Error('showLayoutDialog was not called')
  const options = call[0]
  options.props.onCancel()
}

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
    expect(mockShowLayoutDialog).not.toHaveBeenCalled()
    expect(mockLoadGraphData).not.toHaveBeenCalled()
  })

  it('opens dialog immediately with shareId and loads graph on confirm', async () => {
    mockQueryParams = { share: 'share-id-1' }
    const payload = makePayload()
    mockShowLayoutDialog.mockImplementation(() => {
      expect(mockLoadGraphData).not.toHaveBeenCalled()
      resolveDialogWithConfirm(payload)
    })

    const { loadSharedWorkflowFromUrl } = useSharedWorkflowUrlLoader()
    const loaded = await loadSharedWorkflowFromUrl()

    expect(loaded).toBe('loaded')
    const dialogCall = mockShowLayoutDialog.mock.calls[0][0]
    expect(dialogCall.props.shareId).toBe('share-id-1')
    expect(mockLoadGraphData).toHaveBeenCalledWith(
      { nodes: [] },
      true,
      true,
      'Test Workflow'
    )
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'share'
    )
  })

  it('does not load graph when user cancels dialog', async () => {
    mockQueryParams = { share: 'share-id-1' }
    mockShowLayoutDialog.mockImplementation(() => {
      resolveDialogWithCancel()
    })

    const { loadSharedWorkflowFromUrl } = useSharedWorkflowUrlLoader()
    const loaded = await loadSharedWorkflowFromUrl()

    expect(loaded).toBe('cancelled')
    expect(mockLoadGraphData).not.toHaveBeenCalled()
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'share'
    )
  })

  it('calls import when non-owned assets exist and user confirms', async () => {
    mockQueryParams = { share: 'share-id-1' }
    const payload = makePayload({
      assets: [
        {
          id: 'a1',
          name: 'img.png',
          preview_url: '',
          storage_url: '',
          model: false,
          public: false,
          in_library: false
        }
      ]
    })
    mockShowLayoutDialog.mockImplementation(() => {
      resolveDialogWithConfirm(payload)
    })

    const { loadSharedWorkflowFromUrl } = useSharedWorkflowUrlLoader()
    await loadSharedWorkflowFromUrl()

    expect(mockImportPublishedAssets).toHaveBeenCalledWith(['a1'])
  })

  it('does not call import when user chooses open-only', async () => {
    mockQueryParams = { share: 'share-id-1' }
    const payload = makePayload({
      assets: [
        {
          id: 'a1',
          name: 'img.png',
          preview_url: '',
          storage_url: '',
          model: false,
          public: false,
          in_library: false
        }
      ]
    })
    mockShowLayoutDialog.mockImplementation(() => {
      resolveDialogWithOpenOnly(payload)
    })

    const { loadSharedWorkflowFromUrl } = useSharedWorkflowUrlLoader()
    await loadSharedWorkflowFromUrl()

    expect(mockLoadGraphData).toHaveBeenCalled()
    expect(mockImportPublishedAssets).not.toHaveBeenCalled()
  })

  it('shows toast on import failure and returns loaded-without-assets', async () => {
    mockQueryParams = { share: 'share-id-1' }
    const payload = makePayload({
      assets: [
        {
          id: 'm1',
          name: 'model.safetensors',
          preview_url: '',
          storage_url: '',
          model: true,
          public: false,
          in_library: false
        }
      ]
    })
    mockImportPublishedAssets.mockRejectedValue(new Error('Import failed'))
    mockShowLayoutDialog.mockImplementation(() => {
      resolveDialogWithConfirm(payload)
    })

    const { loadSharedWorkflowFromUrl } = useSharedWorkflowUrlLoader()
    const loaded = await loadSharedWorkflowFromUrl()

    expect(loaded).toBe('loaded-without-assets')
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        detail: 'Failed to import workflow assets'
      })
    )
  })

  it('filters out in_library assets before importing', async () => {
    mockQueryParams = { share: 'share-id-1' }
    const payload = makePayload({
      assets: [
        {
          id: 'a1',
          name: 'needed.png',
          preview_url: '',
          storage_url: '',
          model: false,
          public: false,
          in_library: false
        },
        {
          id: 'a2',
          name: 'already-have.png',
          preview_url: '',
          storage_url: '',
          model: false,
          public: false,
          in_library: true
        }
      ]
    })
    mockShowLayoutDialog.mockImplementation(() => {
      resolveDialogWithConfirm(payload)
    })

    const { loadSharedWorkflowFromUrl } = useSharedWorkflowUrlLoader()
    await loadSharedWorkflowFromUrl()

    expect(mockImportPublishedAssets).toHaveBeenCalledWith(['a1'])
  })

  it('restores preserved share query before loading', async () => {
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue({
      share: 'preserved-share-id'
    })
    mockShowLayoutDialog.mockImplementation(() => {
      resolveDialogWithConfirm(makePayload({ shareId: 'preserved-share-id' }))
    })

    const { loadSharedWorkflowFromUrl } = useSharedWorkflowUrlLoader()
    await loadSharedWorkflowFromUrl()

    expect(preservedQueryMocks.hydratePreservedQuery).toHaveBeenCalledWith(
      'share'
    )
    expect(mockRouterReplace).toHaveBeenCalledWith({
      query: { share: 'preserved-share-id' }
    })
    const dialogCall = mockShowLayoutDialog.mock.calls[0][0]
    expect(dialogCall.props.shareId).toBe('preserved-share-id')
  })

  it('rejects invalid share parameter values', async () => {
    mockQueryParams = { share: '../../../etc/passwd' }

    const { loadSharedWorkflowFromUrl } = useSharedWorkflowUrlLoader()
    const loaded = await loadSharedWorkflowFromUrl()

    expect(loaded).toBe('failed')
    expect(mockShowLayoutDialog).not.toHaveBeenCalled()
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

  it('uses fallback name when payload name is empty', async () => {
    mockQueryParams = { share: 'share-id-1' }
    const payload = makePayload({ name: '' })
    mockShowLayoutDialog.mockImplementation(() => {
      resolveDialogWithConfirm(payload)
    })

    const { loadSharedWorkflowFromUrl } = useSharedWorkflowUrlLoader()
    await loadSharedWorkflowFromUrl()

    expect(mockLoadGraphData).toHaveBeenCalledWith(
      expect.anything(),
      true,
      true,
      'Open shared workflow'
    )
  })
})
