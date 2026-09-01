/**
 * Dialog migration regression net: when callers in `dialogService` open a
 * Reka-migrated dialog, the dialog stack item must carry `renderer: 'reka'`.
 * Catches accidental reverts of the Reka renderer flip.
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

describe('dialogService Reka renderer opt-in', () => {
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

  it("showExecutionErrorDialog() sets renderer 'reka' and size 'lg'", () => {
    useDialogService().showExecutionErrorDialog({
      exception_type: 'RuntimeError',
      exception_message: 'boom',
      node_id: 1,
      node_type: 'KSampler',
      traceback: ['line 1', 'line 2']
    })
    const [args] = showDialog.mock.calls[0]
    expect(args.dialogComponentProps.renderer).toBe('reka')
    expect(args.dialogComponentProps.size).toBe('lg')
  })

  it("showErrorDialog() sets renderer 'reka' and size 'lg'", () => {
    useDialogService().showErrorDialog(new Error('boom'))
    const [args] = showDialog.mock.calls[0]
    expect(args.dialogComponentProps.renderer).toBe('reka')
    expect(args.dialogComponentProps.size).toBe('lg')
  })
})
