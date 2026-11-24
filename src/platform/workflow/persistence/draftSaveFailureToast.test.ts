import { describe, expect, it, vi } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'

import { showDraftSaveFailedToast } from './draftSaveFailureToast'

describe('showDraftSaveFailedToast', () => {
  it('shows a toast for every failure while storage persists', () => {
    showDraftSaveFailedToast()
    showDraftSaveFailedToast()

    expect(useToast().toasts).toHaveLength(2)
  })

  it('shows a single toast while storage is memory-only', () => {
    vi.stubGlobal('localStorage', undefined)
    vi.stubGlobal('sessionStorage', undefined)

    showDraftSaveFailedToast()
    showDraftSaveFailedToast()
    showDraftSaveFailedToast()

    expect(useToast().toasts).toHaveLength(1)
  })
})
