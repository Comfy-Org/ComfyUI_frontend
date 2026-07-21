/**
 * showDowngradeToPersonalDialog must refresh members before the no-members
 * fast path and stay non-dismissable (ESC derives from `closable` in
 * dialogStore); fast-path failures must toast.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const showDialog = vi.hoisted(() => vi.fn())
const closeDialog = vi.hoisted(() => vi.fn())
const isDialogOpen = vi.hoisted(() => vi.fn())
const toastAdd = vi.hoisted(() => vi.fn())
const refreshMembers = vi.hoisted(() => vi.fn())
const downgradeToPersonal = vi.hoisted(() => vi.fn())
const hasOtherMembers = vi.hoisted(() => ({ value: false }))
const openDialogKeys = ref<string[]>([])

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ showDialog, closeDialog, isDialogOpen })
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

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: toastAdd })
}))

vi.mock('@/platform/workspace/composables/useDowngradeToPersonal', () => ({
  useDowngradeToPersonal: () => ({
    hasOtherMembers,
    refreshMembers,
    downgradeToPersonal
  })
}))

vi.mock(
  '@/platform/workspace/components/dialogs/DowngradeRemoveMembersDialogContent.vue',
  () => ({ default: { name: 'DowngradeRemoveMembersDialogContent' } })
)

import { useDialogService } from '@/services/dialogService'

describe('showDowngradeToPersonalDialog', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    hasOtherMembers.value = false
    openDialogKeys.value = []
    refreshMembers.mockResolvedValue(undefined)
    downgradeToPersonal.mockResolvedValue(undefined)
    isDialogOpen.mockImplementation((key: string) =>
      openDialogKeys.value.includes(key)
    )
    showDialog.mockImplementation(({ key }: { key: string }) => {
      openDialogKeys.value = [...openDialogKeys.value, key]
    })
    closeDialog.mockImplementation(({ key }: { key: string }) => {
      openDialogKeys.value = openDialogKeys.value.filter(
        (openKey) => openKey !== key
      )
    })
  })

  const options = { planName: 'Standard', planSlug: 'standard-monthly' }

  it('refreshes members before deciding the no-members fast path', async () => {
    const calls: string[] = []
    refreshMembers.mockImplementation(() => {
      calls.push('refresh')
      return Promise.resolve()
    })
    downgradeToPersonal.mockImplementation(() => {
      calls.push('downgrade')
      return Promise.resolve()
    })

    await useDialogService().showDowngradeToPersonalDialog(options)

    expect(calls).toEqual(['refresh', 'downgrade'])
    expect(downgradeToPersonal).toHaveBeenCalledWith('standard-monthly')
    expect(showDialog).not.toHaveBeenCalled()
  })

  it('returns the downgrade result from the no-members fast path', async () => {
    const result = {
      preview: { allowed: true, transition_type: 'downgrade' },
      response: { billing_op_id: 'op-1', status: 'subscribed' }
    }
    downgradeToPersonal.mockResolvedValue(result)

    await expect(
      useDialogService().showDowngradeToPersonalDialog(options)
    ).resolves.toStrictEqual(result)
  })

  it('shows a non-dismissable confirm dialog when other members exist', async () => {
    hasOtherMembers.value = true

    const resultPromise =
      useDialogService().showDowngradeToPersonalDialog(options)
    await vi.waitFor(() => expect(showDialog).toHaveBeenCalledOnce())

    expect(downgradeToPersonal).not.toHaveBeenCalled()
    expect(closeDialog).toHaveBeenCalledWith({
      key: 'downgrade-remove-members'
    })
    const [args] = showDialog.mock.calls[0]
    expect(args.key).toBe('downgrade-remove-members')
    expect(args.dialogComponentProps.closable).toBe(false)
    expect(args.dialogComponentProps.dismissableMask).toBe(false)

    args.dialogComponentProps.onClose()
    await expect(resultPromise).resolves.toBeNull()
  })

  it('returns the downgrade result after member confirmation', async () => {
    const result = {
      preview: { allowed: true, transition_type: 'downgrade' },
      response: { billing_op_id: 'op-1', status: 'subscribed' }
    }
    hasOtherMembers.value = true
    downgradeToPersonal.mockResolvedValue(result)

    const resultPromise =
      useDialogService().showDowngradeToPersonalDialog(options)
    await vi.waitFor(() => expect(showDialog).toHaveBeenCalledOnce())
    const [args] = showDialog.mock.calls[0]

    await args.props.onConfirm('standard-monthly')

    expect(downgradeToPersonal).toHaveBeenCalledWith('standard-monthly')
    await expect(resultPromise).resolves.toStrictEqual(result)
  })

  it('returns null when the confirmation is removed without closing', async () => {
    hasOtherMembers.value = true

    const resultPromise =
      useDialogService().showDowngradeToPersonalDialog(options)
    await vi.waitFor(() => expect(showDialog).toHaveBeenCalledOnce())

    openDialogKeys.value = []

    await expect(resultPromise).resolves.toBeNull()
  })

  it('toasts and does not rethrow when the fast-path downgrade fails', async () => {
    downgradeToPersonal.mockRejectedValue(new Error('Outstanding balance'))

    await useDialogService().showDowngradeToPersonalDialog(options)

    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        detail: 'Outstanding balance'
      })
    )
    expect(showDialog).not.toHaveBeenCalled()
  })

  it('toasts and aborts when the member refresh fails', async () => {
    hasOtherMembers.value = true
    refreshMembers.mockRejectedValue(new Error('network'))

    await useDialogService().showDowngradeToPersonalDialog(options)

    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: 'network' })
    )
    expect(showDialog).not.toHaveBeenCalled()
    expect(downgradeToPersonal).not.toHaveBeenCalled()
  })
})
