/**
 * Phase 1 dialog migration regression net: when `dialogService.prompt()`,
 * `dialogService.confirm()`, or `dialogService.showBillingComingSoonDialog()`
 * is invoked, the dialog stack item must carry `renderer: 'reka'`. Catches
 * accidental reverts of the Reka renderer flip.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const showDialog = vi.hoisted(() => vi.fn())

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ showDialog })
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ trackEvent: vi.fn() })
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    isActiveSubscription: { value: true },
    isFreeTier: { value: false },
    type: { value: 'legacy' }
  })
}))

import { useDialogService } from '@/services/dialogService'

describe('dialogService Reka renderer opt-in (Phase 1)', () => {
  beforeEach(() => {
    showDialog.mockReset()
  })

  it("prompt() sets renderer 'reka' and size 'md'", () => {
    void useDialogService().prompt({ title: 'T', message: 'M' })
    const [args] = showDialog.mock.calls[0]
    expect(args.dialogComponentProps.renderer).toBe('reka')
    expect(args.dialogComponentProps.size).toBe('md')
  })

  it("confirm() sets renderer 'reka' and size 'md'", () => {
    void useDialogService().confirm({ title: 'T', message: 'M' })
    const [args] = showDialog.mock.calls[0]
    expect(args.dialogComponentProps.renderer).toBe('reka')
    expect(args.dialogComponentProps.size).toBe('md')
  })

  it("showBillingComingSoonDialog() sets renderer 'reka', size 'sm', and 360px contentClass", () => {
    useDialogService().showBillingComingSoonDialog()
    const [args] = showDialog.mock.calls[0]
    expect(args.dialogComponentProps.renderer).toBe('reka')
    expect(args.dialogComponentProps.size).toBe('sm')
    expect(args.dialogComponentProps.contentClass).toBe('max-w-[360px]')
  })
})
