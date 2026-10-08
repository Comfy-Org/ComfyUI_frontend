import { computed } from 'vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
/**
 * Dialog migration regression net: when callers in `dialogService` open a
 * Reka-migrated dialog, the dialog stack item must carry `renderer: 'reka'`.
 * Catches accidental reverts of the Reka renderer flip.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock(import('@/i18n'))

vi.mock(import('@/platform/telemetry'))

beforeEach(() => {
  const billing = useBillingContext()
  billing.canAccessSubscriptionFeatures = computed(() => true)
  billing.isTeamPlan = computed(() => false)
  billing.tier = computed(() => 'STANDARD')
  billing.type = computed(() => 'legacy')
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
  it("prompt() sets renderer 'reka' and size 'md'", async () => {
    const result = useDialogService().prompt({ title: 'T', message: 'M' })
    await vi.waitFor(() =>
      expect(useDialogStore().showDialog).toHaveBeenCalled()
    )
    const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
    expect(args.dialogComponentProps?.renderer).toBe('reka')
    expect(args.dialogComponentProps?.size).toBe('md')
    args.dialogComponentProps?.onRemoved?.()
    await expect(result).resolves.toBeNull()
  })

  it("confirm() sets renderer 'reka' and size 'md'", async () => {
    const result = useDialogService().confirm({ title: 'T', message: 'M' })
    await vi.waitFor(() =>
      expect(useDialogStore().showDialog).toHaveBeenCalled()
    )
    const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
    expect(args.dialogComponentProps?.renderer).toBe('reka')
    expect(args.dialogComponentProps?.size).toBe('md')
    args.dialogComponentProps?.onRemoved?.()
    await expect(result).resolves.toBeNull()
  })

  it('confirm() opens under its own stack key when the caller passes one', async () => {
    const service = useDialogService()
    const shared = service.confirm({ title: 'T', message: 'M' })
    const ownKey = service.confirm({
      key: 'global-desktop-login-confirm',
      title: 'T2',
      message: 'M2'
    })
    await vi.waitFor(() =>
      expect(useDialogStore().showDialog).toHaveBeenCalledTimes(2)
    )
    const calls = vi.mocked(useDialogStore().showDialog).mock.calls
    const keys = calls.slice(-2).map(([args]) => args.key)
    expect(
      new Set(keys),
      'a shared key would make showDialog reuse the open prompt and drop the second resolver, leaving its promise pending forever'
    ).toEqual(new Set(['global-prompt', 'global-desktop-login-confirm']))

    for (const [args] of calls.slice(-2)) {
      args.dialogComponentProps?.onRemoved?.()
    }
    await expect(Promise.all([shared, ownKey])).resolves.toEqual([null, null])
  })

  it('a caller-supplied key does not wait behind an open shared prompt', async () => {
    const service = useDialogService()
    const shared = service.prompt({ title: 'T', message: 'M' })
    await vi.waitFor(() =>
      expect(useDialogStore().showDialog).toHaveBeenCalledTimes(1)
    )

    const ownKey = service.confirm({
      key: 'global-desktop-login-confirm',
      title: 'T2',
      message: 'M2'
    })
    await vi.waitFor(() =>
      expect(useDialogStore().showDialog).toHaveBeenCalledTimes(2)
    )
    const [ownKeyArgs] = vi.mocked(useDialogStore().showDialog).mock.calls[1]
    ownKeyArgs.dialogComponentProps?.onRemoved?.()
    await expect(
      ownKey,
      'the own-key confirm must settle while the shared prompt is still open'
    ).resolves.toBeNull()

    const [sharedArgs] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
    sharedArgs.dialogComponentProps?.onRemoved?.()
    await expect(shared).resolves.toBeNull()
  })

  it('serializes two concurrent confirms that share one caller-supplied key', async () => {
    const service = useDialogService()
    const options = { key: 'global-desktop-login-confirm', message: 'M' }

    const first = service.confirm({ ...options, title: 'First' })
    const second = service.confirm({ ...options, title: 'Second' })

    await vi.waitFor(() =>
      expect(useDialogStore().showDialog).toHaveBeenCalledTimes(1)
    )
    expect(
      vi.mocked(useDialogStore().showDialog).mock.calls[0][0].title,
      'showDialog reuses an open dialog by key, so the second confirm must wait rather than have its resolver dropped'
    ).toBe('First')

    vi.mocked(
      useDialogStore().showDialog
    ).mock.calls[0][0].dialogComponentProps?.onRemoved?.()
    await expect(first).resolves.toBeNull()

    await vi.waitFor(() =>
      expect(useDialogStore().showDialog).toHaveBeenCalledTimes(2)
    )
    expect(vi.mocked(useDialogStore().showDialog).mock.calls[1][0].title).toBe(
      'Second'
    )
    vi.mocked(
      useDialogStore().showDialog
    ).mock.calls[1][0].dialogComponentProps?.onRemoved?.()
    await expect(second).resolves.toBeNull()
  })

  it('releases the FIFO queue when showDialog throws for the head prompt', async () => {
    vi.mocked(useDialogStore().showDialog).mockImplementationOnce(() => {
      throw new Error('boom')
    })
    const service = useDialogService()

    await expect(service.prompt({ title: 'T', message: 'M' })).rejects.toThrow(
      'boom'
    )

    const result = service.confirm({ title: 'T2', message: 'M2' })
    await vi.waitFor(() =>
      expect(useDialogStore().showDialog).toHaveBeenCalledTimes(2)
    )
    const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[1]
    args.dialogComponentProps?.onRemoved?.()
    await expect(result).resolves.toBeNull()
  })

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
