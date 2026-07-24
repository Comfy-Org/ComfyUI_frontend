import { beforeEach, describe, expect, it, vi } from 'vitest'

import { showConfirmDialog } from '@/components/dialog/confirm/confirmDialog'

import type { DownloadStatus } from '../types'
import { DownloadApiError } from '../types'
import { useModelDownloadActions } from './useModelDownloadActions'

const mockStore = {
  pause: vi.fn(),
  resume: vi.fn(),
  cancel: vi.fn(),
  setPriority: vi.fn(),
  hydrate: vi.fn()
}
const mockToastAdd = vi.fn()
const mockCloseDialog = vi.fn()

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('../stores/modelDownloadStore', () => ({
  useModelDownloadStore: () => mockStore
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: mockToastAdd })
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ closeDialog: mockCloseDialog })
}))

vi.mock('@/components/dialog/confirm/confirmDialog')

const mockShowConfirmDialog = vi.mocked(showConfirmDialog)

interface CapturedConfirmOptions {
  footerProps?: {
    confirmVariant?: string
    onConfirm?: () => void | Promise<void>
    onCancel?: () => void
  }
}

function capturedOptions(): CapturedConfirmOptions {
  return mockShowConfirmDialog.mock
    .calls[0][0] as unknown as CapturedConfirmOptions
}

function createDownload(
  overrides: Partial<DownloadStatus> = {}
): DownloadStatus {
  return {
    download_id: 'd1',
    model_id: 'loras/x.safetensors',
    url: 'https://huggingface.co/x.safetensors',
    status: 'active',
    priority: 0,
    total_bytes: null,
    bytes_done: 0,
    progress: null,
    speed_bps: null,
    eta_seconds: null,
    segments: null,
    error: null,
    created_at: 0,
    updated_at: 0,
    ...overrides
  }
}

describe('useModelDownloadActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockShowConfirmDialog.mockReturnValue(
      {} as ReturnType<typeof showConfirmDialog>
    )
  })

  it('pauses a download by id', async () => {
    mockStore.pause.mockResolvedValue(undefined)
    const { pause } = useModelDownloadActions()

    await pause(createDownload({ download_id: 'd1' }))

    expect(mockStore.pause).toHaveBeenCalledWith('d1')
  })

  it('resumes a download by id', async () => {
    mockStore.resume.mockResolvedValue(undefined)
    const { resume } = useModelDownloadActions()

    await resume(createDownload({ download_id: 'd1' }))

    expect(mockStore.resume).toHaveBeenCalledWith('d1')
  })

  it('raises priority relative to the current value', async () => {
    mockStore.setPriority.mockResolvedValue(undefined)
    const { raisePriority } = useModelDownloadActions()

    await raisePriority(createDownload({ download_id: 'd1', priority: 2 }), 1)

    expect(mockStore.setPriority).toHaveBeenCalledWith('d1', 3)
  })

  it('shows an error toast and re-hydrates the store when an action fails', async () => {
    mockStore.pause.mockRejectedValue(new Error('offline'))
    mockStore.hydrate.mockResolvedValue(undefined)
    const { pause } = useModelDownloadActions()

    await pause(createDownload())

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: 'offline' })
    )
    expect(mockStore.hydrate).toHaveBeenCalled()
  })

  it('uses the DownloadApiError message in the toast', async () => {
    mockStore.pause.mockRejectedValue(
      new DownloadApiError('nope', 'URL_NOT_ALLOWED', 400)
    )
    mockStore.hydrate.mockResolvedValue(undefined)
    const { pause } = useModelDownloadActions()

    await pause(createDownload())

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'nope' })
    )
  })

  it('swallows a failed re-hydrate after an action error', async () => {
    mockStore.pause.mockRejectedValue(new Error('offline'))
    mockStore.hydrate.mockRejectedValue(new Error('still offline'))
    const { pause } = useModelDownloadActions()

    await expect(pause(createDownload())).resolves.toBeUndefined()
  })

  describe('cancel', () => {
    it('opens a destructive confirm dialog and only cancels on confirm', async () => {
      mockStore.cancel.mockResolvedValue(undefined)
      const { cancel } = useModelDownloadActions()

      cancel(createDownload({ download_id: 'd1' }))
      expect(capturedOptions().footerProps?.confirmVariant).toBe('destructive')

      await capturedOptions().footerProps?.onConfirm?.()

      expect(mockStore.cancel).toHaveBeenCalledWith('d1')
      expect(mockCloseDialog).toHaveBeenCalled()
    })

    it('does not cancel when the confirm dialog is dismissed', () => {
      const { cancel } = useModelDownloadActions()

      cancel(createDownload({ download_id: 'd1' }))
      capturedOptions().footerProps?.onCancel?.()

      expect(mockStore.cancel).not.toHaveBeenCalled()
      expect(mockCloseDialog).toHaveBeenCalled()
    })
  })
})
