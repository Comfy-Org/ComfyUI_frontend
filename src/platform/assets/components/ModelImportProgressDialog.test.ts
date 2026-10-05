import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useToast } from '@/components/ui/toast/toastStore'
import { reportError } from '@/platform/telemetry/reportError'
import { useAssetDownloadStore } from '@/stores/assetDownloadStore'

import ModelImportProgressDialog from './ModelImportProgressDialog.vue'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderDialog() {
  const store = useAssetDownloadStore()
  store.trackDownload('task-123', 'checkpoints', 'model.safetensors')
  render(ModelImportProgressDialog, {
    global: { plugins: [i18n] }
  })
  return store
}

describe('ModelImportProgressDialog cancellation', () => {
  it('forwards the task ID and disables its cancel action while pending', async () => {
    const user = userEvent.setup()
    const store = renderDialog()
    vi.spyOn(store, 'cancelDownload').mockImplementation((taskId) => {
      store.cancellingTaskIds.add(taskId)
      return new Promise<never>(() => {})
    })

    await user.click(screen.getByRole('button', { name: 'Expand' }))
    const cancelButton = screen.getByRole('button', {
      name: 'Cancel Download'
    })
    await user.click(cancelButton)

    expect(store.cancelDownload).toHaveBeenCalledWith('task-123')
    expect(cancelButton).toBeDisabled()
  })

  it('reports cancellation failures and shows the error toast', async () => {
    const user = userEvent.setup()
    const store = renderDialog()
    const errorToast = vi.spyOn(useToast(), 'error')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('Cancellation unavailable')
    vi.spyOn(store, 'cancelDownload').mockResolvedValue({ ok: false, error })

    await user.click(screen.getByRole('button', { name: 'Expand' }))
    await user.click(screen.getByRole('button', { name: 'Cancel Download' }))

    await waitFor(() => {
      expect(reportError).toHaveBeenCalledWith(error, {
        surface: 'assets',
        errorType: 'asset_download_cancellation_failure',
        logToConsole: false
      })
      expect(errorToast).toHaveBeenCalledWith('Error', {
        description: 'Cancellation unavailable'
      })
    })
  })

  it('allows a provisional cancellation to be dismissed', async () => {
    const user = userEvent.setup()
    const store = renderDialog()

    store.downloadList[0].status = 'cancellation_pending'
    await nextTick()

    await user.click(screen.getByRole('button', { name: 'Close' }))

    await waitFor(() => expect(store.hasDownloads).toBe(false))
  })

  it('restores the close control once a cancellation settles', async () => {
    const store = renderDialog()

    store.downloadList[0].status = 'cancellation_pending'
    await nextTick()
    expect(screen.getByRole('button', { name: 'Close' })).toBeVisible()

    // The store bounds how long a cancellation stays provisional, so the
    // dialog cannot be pinned open without a close control until a reload.
    store.downloadList[0].status = 'cancelled'
    await nextTick()

    expect(screen.getByRole('button', { name: 'Close' })).toBeVisible()
  })

  it('dismisses a settled cancellation', async () => {
    const user = userEvent.setup()
    const store = renderDialog()

    store.downloadList[0].status = 'cancelled'
    await nextTick()

    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(store.hasDownloads).toBe(false)
  })

  it('dismisses a failed download while reconciliation continues', async () => {
    const user = userEvent.setup()
    const store = renderDialog()

    store.downloadList[0].status = 'failed'
    await nextTick()

    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(store.hasDownloads).toBe(false)
  })
})
