import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
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
    vi.spyOn(store, 'cancelDownload').mockImplementation(async (taskId) => {
      store.cancellingTaskIds.add(taskId)
      await new Promise<never>(() => {})
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
    const toastStore = useToastStore()
    const addToast = vi.spyOn(toastStore, 'add')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('Cancellation unavailable')
    vi.spyOn(store, 'cancelDownload').mockRejectedValue(error)

    await user.click(screen.getByRole('button', { name: 'Expand' }))
    await user.click(screen.getByRole('button', { name: 'Cancel Download' }))

    await waitFor(() => {
      expect(reportError).toHaveBeenCalledWith(error, {
        errorType: 'asset_download_cancellation_failure',
        logToConsole: false
      })
      expect(addToast).toHaveBeenCalledWith({
        severity: 'error',
        summary: 'Error',
        detail: 'Cancellation unavailable'
      })
    })
  })
})
