import { computed } from 'vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
/**
 * Dialog migration regression net: when callers in `dialogService` open a
 * Reka-migrated dialog, the dialog stack item must carry `renderer: 'reka'`.
 * Catches accidental reverts of the Reka renderer flip.
 */
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

vi.mock(import('@/i18n'), () => ({
  t: (key: string) => key
}))

vi.mock(import('@/platform/telemetry'))

beforeEach(() => {
  const billing = useBillingContext()
  Object.assign(billing, {
    canAccessSubscriptionFeatures: computed(() => true),
    isTeamPlan: computed(() => false),
    tier: computed(() => 'STANDARD'),
    type: computed(() => 'legacy')
  })
  vi.mocked(useBillingContext).mockReturnValue(billing)
})

vi.mock(import('@/platform/distribution/types'), () => ({
  isCloud: false
}))

vi.mock(import('@/composables/billing/useBillingContext'))

vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))

import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

describe('dialogService Reka renderer opt-in', () => {
  it.for(['prompt', 'confirm'] as const)(
    "%s() sets renderer 'reka' and size 'md'",
    async (method) => {
      const store = useDialogStore()
      const showDialog = vi.mocked(store.showDialog)
      const result = useDialogService()[method]({ title: 'T', message: 'M' })
      onTestFinished(async () => {
        await vi.waitFor(() =>
          expect(store.isDialogOpen('global-prompt')).toBe(true)
        )
        store.closeDialog({ key: 'global-prompt' })
        await result
      })
      await vi.waitFor(() => expect(showDialog).toHaveBeenCalled())
      const [args] = showDialog.mock.calls[0]
      expect(args.dialogComponentProps?.renderer).toBe('reka')
      expect(args.dialogComponentProps?.size).toBe('md')
    }
  )

  it("showBillingComingSoonDialog() sets renderer 'reka', size 'sm', and 360px contentClass", () => {
    useDialogService().showBillingComingSoonDialog()
    const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
    expect(args.dialogComponentProps?.renderer).toBe('reka')
    expect(args.dialogComponentProps?.size).toBe('sm')
    expect(args.dialogComponentProps?.contentClass).toBe('max-w-[360px]')
  })

  it("showExecutionErrorDialog() sets renderer 'reka' and size 'lg'", () => {
    useDialogService().showExecutionErrorDialog({
      exception_type: 'RuntimeError',
      exception_message: 'boom',
      node_id: 1,
      node_type: 'KSampler',
      traceback: ['line 1', 'line 2']
    })
    const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
    expect(args.dialogComponentProps?.renderer).toBe('reka')
    expect(args.dialogComponentProps?.size).toBe('lg')
  })

  it("showErrorDialog() sets renderer 'reka' and size 'lg'", () => {
    useDialogService().showErrorDialog(new Error('boom'))
    const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
    expect(args.dialogComponentProps?.renderer).toBe('reka')
    expect(args.dialogComponentProps?.size).toBe('lg')
  })

  it("showTopUpCreditsDialog() sets renderer 'reka' with a transparent shrink-wrapped chrome", async () => {
    await useDialogService().showTopUpCreditsDialog()
    const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
    expect(args.dialogComponentProps?.renderer).toBe('reka')
    expect(args.dialogComponentProps?.headless).toBe(true)
    expect(args.dialogComponentProps?.pt).toBeUndefined()
    expect(args.dialogComponentProps?.contentClass).toContain('w-fit')
    expect(args.dialogComponentProps?.contentClass).toContain('bg-transparent')
  })

  it("showLayoutDialog() defaults to renderer 'reka' headless without pt", () => {
    const Component = { template: '<div />' }
    useDialogService().showLayoutDialog({
      key: 'layout-test',
      component: Component,
      props: {}
    })
    const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
    expect(args.dialogComponentProps?.renderer).toBe('reka')
    expect(args.dialogComponentProps?.headless).toBe(true)
    expect(args.dialogComponentProps?.pt).toBeUndefined()
  })

  it('showLayoutDialog() lets callers override the defaults', () => {
    const Component = { template: '<div />' }
    useDialogService().showLayoutDialog({
      key: 'layout-override-test',
      component: Component,
      props: {},
      dialogComponentProps: { closable: false, contentClass: 'w-170' }
    })
    const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
    expect(args.dialogComponentProps?.renderer).toBe('reka')
    expect(args.dialogComponentProps?.closable).toBe(false)
    expect(args.dialogComponentProps?.contentClass).toBe('w-170')
  })

  it("showSmallLayoutDialog() sets renderer 'reka' with zeroed section padding", () => {
    const Component = { template: '<div />' }
    useDialogService().showSmallLayoutDialog({
      key: 'small-layout-test',
      component: Component
    })
    const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
    expect(args.dialogComponentProps?.renderer).toBe('reka')
    expect(args.dialogComponentProps?.pt).toBeUndefined()
    expect(args.dialogComponentProps?.contentClass).toContain('w-fit')
    expect(args.dialogComponentProps?.headerClass).toBe('p-0')
    expect(args.dialogComponentProps?.bodyClass).toBe('p-0 overflow-y-hidden')
    expect(args.dialogComponentProps?.footerClass).toBe('p-0')
  })
})
