import { describe, expect, it, vi } from 'vitest'

async function loadToast() {
  vi.resetModules()
  const toasts = await import('@/components/ui/toast/toastStore')
  const { showDraftSaveFailedToast } = await import('./draftSaveFailureToast')
  return { showDraftSaveFailedToast, useToast: toasts.useToast }
}

describe('showDraftSaveFailedToast', () => {
  it('shows a toast for every failure while storage persists', async () => {
    const loaded = await loadToast()

    loaded.showDraftSaveFailedToast()
    loaded.showDraftSaveFailedToast()

    expect(loaded.useToast().toasts).toHaveLength(2)
  })

  it('shows a single toast while storage is memory-only', async () => {
    vi.stubGlobal('localStorage', undefined)
    vi.stubGlobal('sessionStorage', undefined)
    const loaded = await loadToast()

    loaded.showDraftSaveFailedToast()
    loaded.showDraftSaveFailedToast()
    loaded.showDraftSaveFailedToast()

    expect(loaded.useToast().toasts).toHaveLength(1)
  })
})
