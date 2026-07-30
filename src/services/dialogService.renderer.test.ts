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

  it("showTopUpCreditsDialog() sets renderer 'reka' with a transparent shrink-wrapped chrome", async () => {
    await useDialogService().showTopUpCreditsDialog()
    const [args] = showDialog.mock.calls[0]
    expect(args.dialogComponentProps.renderer).toBe('reka')
    expect(args.dialogComponentProps.headless).toBe(true)
    expect(args.dialogComponentProps.pt).toBeUndefined()
    expect(args.dialogComponentProps.contentClass).toContain('w-fit')
    expect(args.dialogComponentProps.contentClass).toContain('bg-transparent')
  })

  it('showAutoReloadDialog() uses the headless workspace dialog chrome', async () => {
    const canOpen = vi.fn(() => true)
    await useDialogService().showAutoReloadDialog({
      workspaceId: 'workspace-a',
      canOpen
    })
    const [args] = showDialog.mock.calls[0]
    expect(args.key).toBe('auto-reload')
    expect(args.props).toEqual({ workspaceId: 'workspace-a' })
    expect(args.dialogComponentProps.renderer).toBe('reka')
    expect(args.dialogComponentProps.headless).toBe(true)
    expect(args.dialogComponentProps.contentClass).toContain('w-fit')
    expect(args.dialogComponentProps.contentClass).toContain('bg-transparent')
    expect(canOpen).toHaveBeenCalledTimes(2)
  })

  it('showAutoReloadDialog() rejects a guard that becomes stale during lazy loading', async () => {
    const canOpen = vi
      .fn<() => boolean>()
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)

    await useDialogService().showAutoReloadDialog({
      workspaceId: 'workspace-a',
      canOpen
    })

    expect(canOpen).toHaveBeenCalledTimes(2)
    expect(showDialog).not.toHaveBeenCalled()
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
