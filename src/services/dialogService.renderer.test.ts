/**
 * Dialog migration regression net: when callers in `dialogService` open a
 * Reka-migrated dialog, the dialog stack item must carry `renderer: 'reka'`.
 * Catches accidental reverts of the Reka renderer flip.
 */
import { describe, expect, it, vi } from 'vitest'

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
    canAccessSubscriptionFeatures: { value: true },
    isTeamPlan: { value: false },
    tier: { value: 'STANDARD' },
    type: { value: 'legacy' }
  })
}))

vi.mock('@/platform/workspace/composables/useBillingCapabilities', () => ({
  useBillingCapabilities: () => ({
    canTopUp: { value: true },
    canSubscribeSelfServe: { value: false },
    isReady: { value: true }
  })
}))

import { SELF_STYLED_PANEL_CONTENT_CLASS } from '@/components/ui/dialog/dialog.variants'
import { useDialogService } from '@/services/dialogService'

describe('dialogService Reka renderer opt-in', () => {
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

  it('confirm() opens under its own stack key when the caller passes one', () => {
    void useDialogService().confirm({ title: 'T', message: 'M' })
    void useDialogService().confirm({
      key: 'global-desktop-login-confirm',
      title: 'T2',
      message: 'M2'
    })
    const keys = showDialog.mock.calls.slice(-2).map(([args]) => args.key)
    expect(
      keys,
      'a shared key would make showDialog reuse the open prompt and drop the second resolver, leaving its promise pending forever'
    ).toEqual(['global-prompt', 'global-desktop-login-confirm'])
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

  it("showTopUpCreditsDialog() sets renderer 'reka' with a transparent shrink-wrapped chrome", async () => {
    await useDialogService().showTopUpCreditsDialog()
    const [args] = showDialog.mock.calls[0]
    expect(args.dialogComponentProps.renderer).toBe('reka')
    expect(args.dialogComponentProps.headless).toBe(true)
    expect(args.dialogComponentProps.pt).toBeUndefined()
    expect(args.dialogComponentProps.contentClass).toBe(
      SELF_STYLED_PANEL_CONTENT_CLASS
    )
  })

  it("showLayoutDialog() defaults to renderer 'reka' headless without pt", () => {
    const Component = { template: '<div />' }
    useDialogService().showLayoutDialog({
      key: 'layout-test',
      component: Component,
      props: {}
    })
    const [args] = showDialog.mock.calls[0]
    expect(args.dialogComponentProps.renderer).toBe('reka')
    expect(args.dialogComponentProps.headless).toBe(true)
    expect(args.dialogComponentProps.pt).toBeUndefined()
  })

  it('showLayoutDialog() lets callers override the defaults', () => {
    const Component = { template: '<div />' }
    useDialogService().showLayoutDialog({
      key: 'layout-override-test',
      component: Component,
      props: {},
      dialogComponentProps: { closable: false, contentClass: 'w-170' }
    })
    const [args] = showDialog.mock.calls[0]
    expect(args.dialogComponentProps.renderer).toBe('reka')
    expect(args.dialogComponentProps.closable).toBe(false)
    expect(args.dialogComponentProps.contentClass).toBe('w-170')
  })

  it("showSmallLayoutDialog() sets renderer 'reka' with zeroed section padding", () => {
    const Component = { template: '<div />' }
    useDialogService().showSmallLayoutDialog({
      key: 'small-layout-test',
      component: Component
    })
    const [args] = showDialog.mock.calls[0]
    expect(args.dialogComponentProps.renderer).toBe('reka')
    expect(args.dialogComponentProps.pt).toBeUndefined()
    expect(args.dialogComponentProps.contentClass).toContain('w-fit')
    expect(args.dialogComponentProps.headerClass).toBe('p-0')
    expect(args.dialogComponentProps.bodyClass).toBe('p-0 overflow-y-hidden')
    expect(args.dialogComponentProps.footerClass).toBe('p-0')
  })
})
