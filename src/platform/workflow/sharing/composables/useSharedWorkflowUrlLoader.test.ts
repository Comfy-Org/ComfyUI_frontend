import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSharedWorkflowUrlLoader } from '@/platform/workflow/sharing/composables/useSharedWorkflowUrlLoader'
import type { SharedWorkflowPayload } from '@/platform/workflow/sharing/types/shareTypes'

const preservedQueryMocks = vi.hoisted(() => ({
  capturePreservedQuery: vi.fn(),
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
const mockIsLoggedIn = vi.hoisted(() => ({ value: false }))
const mockTrackShareLinkOpened = vi.hoisted(() => vi.fn())

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    isLoggedIn: mockIsLoggedIn
  })
}))

vi.mock('@/composables/useAppMode', () => ({
  useAppMode: () => ({
    mode: { value: 'graph' },
    isAppMode: { value: false }
  })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackShareLinkOpened: mockTrackShareLinkOpened
  })
}))

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
const mockHideTemplateSelector = vi.hoisted(() => vi.fn())
const mockDialogStack = vi.hoisted(
  () =>
    [] as Array<{
      key: string
      contentProps: Record<string, unknown>
      dialogComponentProps: Record<string, unknown>
    }>
)
const mockUpdateDialog = vi.hoisted(() => vi.fn())

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    showLayoutDialog: mockShowLayoutDialog
  })
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({
    dialogStack: mockDialogStack,
    closeDialog: mockCloseDialog,
    updateDialog: mockUpdateDialog
  })
}))

vi.mock('@/composables/useWorkflowTemplateSelectorDialog', () => ({
  useWorkflowTemplateSelectorDialog: () => ({
    hide: mockHideTemplateSelector
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
    workflowJson: fromPartial<SharedWorkflowPayload['workflowJson']>({
      nodes: []
    }),
    assets: [],
    ...overrides
  }
}

function resolveDialogWithConfirm(payload: SharedWorkflowPayload) {
  getLastDialogOptions().props.onConfirm(payload)
}

function resolveDialogWithOpenOnly(payload: SharedWorkflowPayload) {
  getLastDialogOptions().props.onOpenWithoutImporting(payload)
}

function resolveDialogWithCancel() {
  const call = mockShowLayoutDialog.mock.calls.at(-1)
  if (!call) throw new Error('showLayoutDialog was not called')
  const options = call[0]
  options.props.onCancel()
}

function getLastDialogOptions() {
  const call = mockShowLayoutDialog.mock.calls.at(-1)
  if (!call) throw new Error('showLayoutDialog was not called')
  return call[0]
}

function createDialogInstance(options: {
  key: string
  props: Record<string, unknown>
  dialogComponentProps?: Record<string, unknown>
}) {
  const dialog = {
    key: options.key,
    contentProps: { ...options.props },
    dialogComponentProps: { ...options.dialogComponentProps }
  }
  mockDialogStack.push(dialog)
  return dialog
}

function createDeferred() {
  let resolve!: () => void
  const promise = new Promise<void>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe('useSharedWorkflowUrlLoader', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockQueryParams = {}
    mockIsLoggedIn.value = false
    mockDialogStack.length = 0
    mockShowLayoutDialog.mockImplementation(createDialogInstance)
    mockUpdateDialog.mockImplementation(
      (options: {
        key: string
        contentProps?: Record<string, unknown>
        dialogComponentProps?: Record<string, unknown>
      }) => {
        const dialog = mockDialogStack.find((item) => item.key === options.key)
        if (!dialog) return false

        if (options.contentProps) {
          dialog.contentProps = {
            ...dialog.contentProps,
            ...options.contentProps
          }
        }

        if (options.dialogComponentProps) {
          dialog.dialogComponentProps = {
            ...dialog.dialogComponentProps,
            ...options.dialogComponentProps
          }
        }

        return true
      }
    )
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue(null)
  })

  it('does nothing when no share query param is present', async () => {
    const { loadSharedWorkflowFromUrl } = useSharedWorkflowUrlLoader()

    const loaded = await loadSharedWorkflowFromUrl()

    expect(loaded).toBe('not-present')
    expect(mockShowLayoutDialog).not.toHaveBeenCalled()
    expect(mockLoadGraphData).not.toHaveBeenCalled()
    expect(mockTrackShareLinkOpened).not.toHaveBeenCalled()
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
      'Test Workflow',
      { openSource: 'shared_url', shareId: 'share-id-1' }
    )
    expect(mockTrackShareLinkOpened).toHaveBeenCalledWith({
      share_id: 'share-id-1',
      is_authenticated: false,
      view_mode: 'graph',
      is_app_mode: false
    })
    expect(preservedQueryMocks.capturePreservedQuery).toHaveBeenCalledWith(
      'share_auth',
      { share: 'share-id-1' },
      ['share']
    )
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'share'
    )
  })

  it('does not capture share auth attribution for authenticated users', async () => {
    mockQueryParams = { share: 'share-id-1' }
    mockIsLoggedIn.value = true
    mockShowLayoutDialog.mockImplementation(() => {
      resolveDialogWithConfirm(makePayload())
    })

    const { loadSharedWorkflowFromUrl } = useSharedWorkflowUrlLoader()
    const loaded = await loadSharedWorkflowFromUrl()

    expect(loaded).toBe('loaded')
    expect(mockTrackShareLinkOpened).toHaveBeenCalledWith({
      share_id: 'share-id-1',
      is_authenticated: true,
      view_mode: 'graph',
      is_app_mode: false
    })
    expect(preservedQueryMocks.capturePreservedQuery).not.toHaveBeenCalled()
  })

  it('hides template selector when user confirms opening shared workflow', async () => {
    mockQueryParams = { share: 'share-id-1' }
    mockShowLayoutDialog.mockImplementation(() => {
      resolveDialogWithConfirm(makePayload())
    })

    const { loadSharedWorkflowFromUrl } = useSharedWorkflowUrlLoader()
    await loadSharedWorkflowFromUrl()

    expect(mockHideTemplateSelector).toHaveBeenCalledTimes(1)
  })

  it('keeps dialog open with opening state while shared workflow loads', async () => {
    mockQueryParams = { share: 'share-id-1' }
    const graphLoad = createDeferred()
    mockLoadGraphData.mockReturnValue(graphLoad.promise)

    const { loadSharedWorkflowFromUrl } = useSharedWorkflowUrlLoader()
    const loadPromise = loadSharedWorkflowFromUrl()
    await Promise.resolve()
    const dialogOptions = getLastDialogOptions()
    const dialogInstance = mockShowLayoutDialog.mock.results[0].value

    dialogOptions.props.onConfirm(makePayload())
    await Promise.resolve()

    expect(dialogInstance.contentProps.openingAction).toBe('copy-and-open')
    expect(mockUpdateDialog).toHaveBeenCalledWith({
      key: 'open-shared-workflow',
      contentProps: { openingAction: 'copy-and-open' }
    })
    expect(dialogInstance.dialogComponentProps.closable).toBeUndefined()
    expect(dialogInstance.dialogComponentProps.closeOnEscape).toBeUndefined()
    expect(dialogInstance.dialogComponentProps.dismissableMask).toBeUndefined()
    expect(mockCloseDialog).not.toHaveBeenCalled()

    graphLoad.resolve()
    await loadPromise

    expect(mockCloseDialog).toHaveBeenLastCalledWith({
      key: 'open-shared-workflow'
    })
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
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'share_auth'
    )
  })

  it('does not hide template selector when user cancels shared workflow dialog', async () => {
    mockQueryParams = { share: 'share-id-1' }
    mockShowLayoutDialog.mockImplementation(() => {
      resolveDialogWithCancel()
    })

    const { loadSharedWorkflowFromUrl } = useSharedWorkflowUrlLoader()
    await loadSharedWorkflowFromUrl()

    expect(mockHideTemplateSelector).not.toHaveBeenCalled()
  })

  it('imports non-owned assets before loading graph when user confirms', async () => {
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
    const loaded = await loadSharedWorkflowFromUrl()

    expect(loaded).toBe('loaded')
    expect(mockImportPublishedAssets).toHaveBeenCalledWith(['a1'], 'share-id-1')
    expect(mockImportPublishedAssets.mock.invocationCallOrder[0]).toBeLessThan(
      mockLoadGraphData.mock.invocationCallOrder[0]
    )
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

  it('hides template selector when user chooses open-only', async () => {
    mockQueryParams = { share: 'share-id-1' }
    mockShowLayoutDialog.mockImplementation(() => {
      resolveDialogWithOpenOnly(makePayload())
    })

    const { loadSharedWorkflowFromUrl } = useSharedWorkflowUrlLoader()
    await loadSharedWorkflowFromUrl()

    expect(mockHideTemplateSelector).toHaveBeenCalledTimes(1)
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
    expect(mockLoadGraphData).toHaveBeenCalledWith(
      { nodes: [] },
      true,
      true,
      'Test Workflow',
      { openSource: 'shared_url', shareId: 'share-id-1' }
    )
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        detail: 'Failed to import workflow assets'
      })
    )
  })

  it('clears share intent when graph load fails after importing assets', async () => {
    mockQueryParams = { share: 'share-id-1', tab: 'assets' }
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
    mockLoadGraphData.mockRejectedValue(new Error('Graph load failed'))

    const { loadSharedWorkflowFromUrl } = useSharedWorkflowUrlLoader()
    const loaded = await loadSharedWorkflowFromUrl()

    expect(loaded).toBe('failed')
    expect(mockImportPublishedAssets).toHaveBeenCalledWith(['a1'], 'share-id-1')
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: { tab: 'assets' } })
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'share'
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

    expect(mockImportPublishedAssets).toHaveBeenCalledWith(['a1'], 'share-id-1')
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
      detail: 'Failed to load shared workflow'
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
      'Open shared workflow',
      { openSource: 'shared_url', shareId: 'share-id-1' }
    )
  })
})
