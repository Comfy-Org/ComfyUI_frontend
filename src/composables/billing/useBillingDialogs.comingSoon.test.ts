import { describe, expect, it, vi } from 'vitest'

import { useBillingDialogs } from '@/composables/billing/useBillingDialogs'
import { useDialogStore } from '@/stores/dialogStore'

vi.mock(import('@/i18n'))

describe('showBillingComingSoonDialog', () => {
  it("opens at size 'sm' with a 360px contentClass", () => {
    useBillingDialogs().showBillingComingSoonDialog()
    const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
    expect(args.dialogComponentProps?.size).toBe('sm')
    expect(args.dialogComponentProps?.contentClass).toBe('max-w-[360px]')
  })
})
