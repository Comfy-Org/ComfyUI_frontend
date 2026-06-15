import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAccountPreconditionDialog } from './useAccountPreconditionDialog'

const mockDialogService = {
  showApiNodesSignInDialog: vi.fn(),
  showSubscriptionRequiredDialog: vi.fn(),
  showTopUpCreditsDialog: vi.fn()
}

const mockCanRoute = vi.fn((_precondition: string) => true)

vi.mock('@/services/dialogService', () => ({
  useDialogService: vi.fn(() => mockDialogService)
}))

vi.mock('@/platform/errorCatalog/accountPreconditionRouting', () => ({
  canRoutePreconditionToModal: (precondition: string) =>
    mockCanRoute(precondition)
}))

describe('useAccountPreconditionDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanRoute.mockReturnValue(true)
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

  it('does not open a dialog and returns false when the precondition cannot be routed', () => {
    mockCanRoute.mockReturnValue(false)

    const shown = useAccountPreconditionDialog().open('subscription')

    expect(shown).toBe(false)
    expect(
      mockDialogService.showSubscriptionRequiredDialog
    ).not.toHaveBeenCalled()
  })

  it('returns true when a modal is shown', () => {
    expect(useAccountPreconditionDialog().open('subscription')).toBe(true)
    expect(useAccountPreconditionDialog().open('sign_in')).toBe(true)
    expect(useAccountPreconditionDialog().open('credits')).toBe(true)
  })
})
