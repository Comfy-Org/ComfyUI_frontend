import { useDialogService } from '@/services/dialogService'
import { describe, expect, it, vi } from 'vitest'

import { mockBillingContext } from '@/utils/__tests__/mockBillingContext'

import { useAccountPreconditionDialog } from './useAccountPreconditionDialog'

vi.mock(import('@/services/dialogService'))

vi.mock(import('@/composables/billing/useBillingContext'))

describe('useAccountPreconditionDialog', () => {
  it('routes a sign-in precondition to the API sign-in dialog with the node type', () => {
    useAccountPreconditionDialog().open('sign_in', { nodeType: 'ApiNode' })

    expect(useDialogService().showApiNodesSignInDialog).toHaveBeenCalledWith([
      'ApiNode'
    ])
    expect(
      useDialogService().showSubscriptionRequiredDialog
    ).not.toHaveBeenCalled()
    expect(useDialogService().showTopUpCreditsDialog).not.toHaveBeenCalled()
  })

  it('routes a sign-in precondition with no node type to an empty list', () => {
    useAccountPreconditionDialog().open('sign_in')

    expect(useDialogService().showApiNodesSignInDialog).toHaveBeenCalledWith([])
  })

  it('routes a subscription precondition to the subscription dialog', () => {
    useAccountPreconditionDialog().open('subscription')

    expect(
      useDialogService().showSubscriptionRequiredDialog
    ).toHaveBeenCalledTimes(1)
    expect(useDialogService().showApiNodesSignInDialog).not.toHaveBeenCalled()
    expect(useDialogService().showTopUpCreditsDialog).not.toHaveBeenCalled()
  })

  it('routes a credit precondition to the top-up dialog', () => {
    useAccountPreconditionDialog().open('credits', { nodeType: 'PartnerNode' })

    expect(useDialogService().showTopUpCreditsDialog).toHaveBeenCalledWith({
      isInsufficientCredits: true
    })
    expect(
      useDialogService().showSubscriptionRequiredDialog
    ).not.toHaveBeenCalled()
  })

  // A caller that names no source must keep emitting exactly what it emitted
  // before the source existed, or threading the agent paywall through this
  // shared seam silently re-attributes the execution-error and
  // prompt-precondition callers in app.ts.
  it('attributes a subscription precondition to subscription_required when no source is named', () => {
    useAccountPreconditionDialog().open('subscription')

    expect(
      useDialogService().showSubscriptionRequiredDialog
    ).toHaveBeenCalledWith({ reason: 'subscription_required' })
  })

  it('omits a source from the top-up dialog when none is named', () => {
    useAccountPreconditionDialog().open('credits')

    expect(useDialogService().showTopUpCreditsDialog).toHaveBeenCalledWith({
      isInsufficientCredits: true
    })
  })

  it('attributes a subscription precondition to the source that triggered it', () => {
    useAccountPreconditionDialog().open('subscription', {
      source: 'agent_paywall'
    })

    expect(
      useDialogService().showSubscriptionRequiredDialog
    ).toHaveBeenCalledWith({ reason: 'agent_paywall' })
  })

  it('carries the triggering source into the top-up dialog', () => {
    useAccountPreconditionDialog().open('credits', {
      source: 'agent_paywall'
    })

    expect(useDialogService().showTopUpCreditsDialog).toHaveBeenCalledWith({
      isInsufficientCredits: true,
      source: 'agent_paywall'
    })
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
