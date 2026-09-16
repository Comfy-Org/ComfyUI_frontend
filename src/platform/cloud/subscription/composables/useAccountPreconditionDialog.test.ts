import { describe, expect, it, vi } from 'vitest'

import { mockBillingContext } from '@/utils/__tests__/mockBillingContext'

import { useAccountPreconditionDialog } from './useAccountPreconditionDialog'

const mockDialogService = {
  showApiNodesSignInDialog: vi.fn(),
  showSubscriptionRequiredDialog: vi.fn(),
  showTopUpCreditsDialog: vi.fn()
}

vi.mock<unknown>(import('@/services/dialogService'), () => ({
  useDialogService: vi.fn(() => mockDialogService)
}))

vi.mock(import('@/composables/billing/useBillingContext'))

describe('useAccountPreconditionDialog', () => {
  it('routes a sign-in precondition to the API sign-in dialog with the node type', () => {
    useAccountPreconditionDialog().open('sign_in', { nodeType: 'ApiNode' })

    expect(mockDialogService.showApiNodesSignInDialog).toHaveBeenCalledWith([
      'ApiNode'
    ])
    expect(
      mockDialogService.showSubscriptionRequiredDialog
    ).not.toHaveBeenCalled()
    expect(mockDialogService.showTopUpCreditsDialog).not.toHaveBeenCalled()
  })

  it('routes a sign-in precondition with no node type to an empty list', () => {
    useAccountPreconditionDialog().open('sign_in')

    expect(mockDialogService.showApiNodesSignInDialog).toHaveBeenCalledWith([])
  })

  it('routes a subscription precondition to the subscription dialog', () => {
    useAccountPreconditionDialog().open('subscription')

    expect(
      mockDialogService.showSubscriptionRequiredDialog
    ).toHaveBeenCalledTimes(1)
    expect(mockDialogService.showApiNodesSignInDialog).not.toHaveBeenCalled()
    expect(mockDialogService.showTopUpCreditsDialog).not.toHaveBeenCalled()
  })

  it('routes a credit precondition to the top-up dialog', () => {
    useAccountPreconditionDialog().open('credits', { nodeType: 'PartnerNode' })

    expect(mockDialogService.showTopUpCreditsDialog).toHaveBeenCalledWith({
      isInsufficientCredits: true
    })
    expect(
      mockDialogService.showSubscriptionRequiredDialog
    ).not.toHaveBeenCalled()
  })

  it('refreshes the billing snapshot on a credit precondition so exhausted-state surfaces converge', () => {
    const billing = mockBillingContext()
    useAccountPreconditionDialog().open('credits')

    expect(billing.fetchStatus).toHaveBeenCalledTimes(1)
    expect(billing.fetchBalance).toHaveBeenCalledTimes(1)
  })

  it('does not touch billing state for non-credit preconditions', () => {
    const billing = mockBillingContext()
    useAccountPreconditionDialog().open('subscription')

    expect(billing.fetchStatus).not.toHaveBeenCalled()
    expect(billing.fetchBalance).not.toHaveBeenCalled()
  })
})
