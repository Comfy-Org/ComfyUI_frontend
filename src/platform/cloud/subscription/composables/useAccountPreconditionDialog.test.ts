import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAccountPreconditionDialog } from './useAccountPreconditionDialog'

const mockDialogService = {
  showApiNodesSignInDialog: vi.fn(),
  showSubscriptionRequiredDialog: vi.fn(),
  showTopUpCreditsDialog: vi.fn()
}

const mockBilling = {
  fetchStatus: vi.fn(),
  fetchBalance: vi.fn()
}

vi.mock('@/services/dialogService', () => ({
  useDialogService: vi.fn(() => mockDialogService)
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: vi.fn(() => mockBilling)
}))

describe('useAccountPreconditionDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

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
    useAccountPreconditionDialog().open('credits')

    expect(mockBilling.fetchStatus).toHaveBeenCalledTimes(1)
    expect(mockBilling.fetchBalance).toHaveBeenCalledTimes(1)
  })

  it('does not touch billing state for non-credit preconditions', () => {
    useAccountPreconditionDialog().open('subscription')

    expect(mockBilling.fetchStatus).not.toHaveBeenCalled()
    expect(mockBilling.fetchBalance).not.toHaveBeenCalled()
  })
})
