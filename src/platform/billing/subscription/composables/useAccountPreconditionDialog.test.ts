import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { useBillingDialogs } from '@/platform/billing/composables/useBillingDialogs'
import { describe, expect, it, vi } from 'vitest'

import { getPreservedQueryParam } from '@/platform/navigation/preservedQueryManager'
import { useWorkspaceCreditsSource } from '@/platform/workspace/ports/workspaceCreditsSource'
import { useDialogStore } from '@/stores/dialogStore'
import { mockBillingContext } from '@/utils/__tests__/mockBillingContext'

import { useAccountPreconditionDialog } from './useAccountPreconditionDialog'

vi.mock(import('@/services/dialogService'))
vi.mock(import('@/composables/auth/useAuthDialogs'))
vi.mock(import('@/platform/billing/composables/useBillingDialogs'))

vi.mock(import('@/platform/billing/composables/useBillingContext'))
vi.mock(import('@/platform/workspace/ports/workspaceCreditsSource'))
vi.mock(import('@/config/comfyApi'), () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.comfy.org'
}))

function mockCreditsSource(
  personalSwitch: 'active' | 'reloading' | 'failed' = 'active'
) {
  const source = {
    teamWorkspaces: [{ id: 'ws-acme', name: 'Acme' }],
    switchWorkspace: vi.fn().mockResolvedValue(true),
    switchToPersonalWorkspace: vi.fn().mockResolvedValue(personalSwitch)
  }
  vi.mocked(useWorkspaceCreditsSource).mockReturnValue(source)
  return source
}

function personalWalletDialogProps() {
  const dialog = useDialogStore().dialogStack.find(
    (d) => d.key === 'personal-wallet-credits'
  )
  return dialog?.contentProps as
    | { credential: string; onAddCredits: () => Promise<void> }
    | undefined
}

describe('useAccountPreconditionDialog', () => {
  it('routes a sign-in precondition to the API sign-in dialog with the node type', async () => {
    await useAccountPreconditionDialog().open('sign_in', {
      nodeType: 'ApiNode'
    })

    expect(useAuthDialogs().showApiNodesSignInDialog).toHaveBeenCalledWith([
      'ApiNode'
    ])
    expect(
      useBillingDialogs().showSubscriptionRequiredDialog
    ).not.toHaveBeenCalled()
    expect(useBillingDialogs().showTopUpCreditsDialog).not.toHaveBeenCalled()
  })

  it('routes a sign-in precondition with no node type to an empty list', async () => {
    await useAccountPreconditionDialog().open('sign_in')

    expect(useAuthDialogs().showApiNodesSignInDialog).toHaveBeenCalledWith([])
  })

  it('routes a subscription precondition to the subscription dialog', async () => {
    await useAccountPreconditionDialog().open('subscription')

    expect(
      useBillingDialogs().showSubscriptionRequiredDialog
    ).toHaveBeenCalledTimes(1)
    expect(useAuthDialogs().showApiNodesSignInDialog).not.toHaveBeenCalled()
    expect(useBillingDialogs().showTopUpCreditsDialog).not.toHaveBeenCalled()
  })

  it('carries the refusal facts to the subscription dialog', async () => {
    await useAccountPreconditionDialog().open('subscription', {
      creditsLocked: true,
      refusalType: 'CLOUD_SUBSCRIPTION_REQUIRED'
    })

    expect(
      useBillingDialogs().showSubscriptionRequiredDialog
    ).toHaveBeenCalledExactlyOnceWith({
      reason: 'subscription_required',
      creditsLocked: true,
      refusalType: 'CLOUD_SUBSCRIPTION_REQUIRED'
    })
  })

  it('routes a credit precondition to the top-up dialog', async () => {
    await useAccountPreconditionDialog().open('credits', {
      nodeType: 'PartnerNode'
    })

    expect(useBillingDialogs().showTopUpCreditsDialog).toHaveBeenCalledWith({
      isInsufficientCredits: true
    })
    expect(
      useBillingDialogs().showSubscriptionRequiredDialog
    ).not.toHaveBeenCalled()
  })

  it('attributes a subscription precondition to subscription_required when no source is named', async () => {
    await useAccountPreconditionDialog().open('subscription')

    expect(
      useBillingDialogs().showSubscriptionRequiredDialog
    ).toHaveBeenCalledWith({ reason: 'subscription_required' })
  })

  it('omits a source from the top-up dialog when none is named', async () => {
    await useAccountPreconditionDialog().open('credits')

    expect(useBillingDialogs().showTopUpCreditsDialog).toHaveBeenCalledWith({
      isInsufficientCredits: true
    })
  })

  it('attributes a subscription precondition to the source that triggered it', async () => {
    await useAccountPreconditionDialog().open('subscription', {
      source: 'agent_paywall'
    })

    expect(
      useBillingDialogs().showSubscriptionRequiredDialog
    ).toHaveBeenCalledWith({ reason: 'agent_paywall' })
  })

  it('carries the triggering source into the top-up dialog', async () => {
    await useAccountPreconditionDialog().open('credits', {
      source: 'agent_paywall'
    })

    expect(useBillingDialogs().showTopUpCreditsDialog).toHaveBeenCalledWith({
      isInsufficientCredits: true,
      source: 'agent_paywall'
    })
  })

  it('refreshes the billing snapshot on a credit precondition so exhausted-state surfaces converge', async () => {
    const billing = mockBillingContext()
    await useAccountPreconditionDialog().open('credits')

    expect(billing.fetchStatus).toHaveBeenCalledTimes(1)
    expect(billing.fetchBalance).toHaveBeenCalledTimes(1)
  })

  it('does not touch billing state for non-credit preconditions', async () => {
    const billing = mockBillingContext()
    await useAccountPreconditionDialog().open('subscription')

    expect(billing.fetchStatus).not.toHaveBeenCalled()
    expect(billing.fetchBalance).not.toHaveBeenCalled()
  })

  it('replaces an open personal-wallet dialog with the latest credential', async () => {
    mockCreditsSource()
    const dialog = useAccountPreconditionDialog()

    await dialog.open('personal_wallet_session')
    await dialog.open('personal_wallet_api_key')

    expect(personalWalletDialogProps()?.credential).toBe('api_key')
    expect(
      useDialogStore().dialogStack.filter(
        (d) => d.key === 'personal-wallet-credits'
      )
    ).toHaveLength(1)
  })

  it('switches to the personal workspace before topping up personal credits', async () => {
    const source = mockCreditsSource()
    await useAccountPreconditionDialog().open('personal_wallet_api_key')

    await personalWalletDialogProps()?.onAddCredits()

    expect(source.switchToPersonalWorkspace).toHaveBeenCalledOnce()
    expect(useBillingDialogs().showTopUpCreditsDialog).toHaveBeenCalledWith({
      isInsufficientCredits: true
    })
    expect(personalWalletDialogProps()).toBeUndefined()
    expect(getPreservedQueryParam('topup', 'topup')).toBeUndefined()
  })

  it('keeps the personal-wallet dialog open when the personal workspace switch fails', async () => {
    mockCreditsSource('failed')
    await useAccountPreconditionDialog().open('personal_wallet_session')

    await personalWalletDialogProps()?.onAddCredits()

    expect(useBillingDialogs().showTopUpCreditsDialog).not.toHaveBeenCalled()
    expect(personalWalletDialogProps()).toBeDefined()
    expect(getPreservedQueryParam('topup', 'topup')).toBeUndefined()
  })

  it('defers the top-up to the next boot when the personal workspace switch reloads the page', async () => {
    mockCreditsSource('reloading')
    await useAccountPreconditionDialog().open('personal_wallet_api_key')

    await personalWalletDialogProps()?.onAddCredits()

    expect(useBillingDialogs().showTopUpCreditsDialog).not.toHaveBeenCalled()
    expect(getPreservedQueryParam('topup', 'topup')).toBe('out_of_credits')
  })
})
