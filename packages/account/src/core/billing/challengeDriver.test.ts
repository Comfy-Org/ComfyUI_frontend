import { describe, expect, it, vi } from 'vitest'

import { driveEmbeddedChallenge } from './challengeDriver.js'
import type { BillingOperationState } from './operationState.js'

const SCOPE = { userId: 'uid-1', workspaceId: 'ws-1', role: 'owner' } as const

function challenged(
  overrides: Partial<Extract<BillingOperationState, { phase: 'pending' }>> = {}
): BillingOperationState {
  return {
    id: 'op-1',
    kind: 'topup',
    scope: SCOPE,
    presentation: 'embedded',
    observedAt: 0,
    attemptStartedAt: 0,
    phase: 'pending',
    challenge: { clientSecret: 'pi_secret', status: 'required' },
    customerActionSeen: true,
    ...overrides
  }
}

function fakeLifecycle(state: BillingOperationState | undefined) {
  return {
    get: vi.fn(() => state),
    reportChallengeStarted: vi.fn(),
    reportChallengeSettled: vi.fn()
  }
}

describe('driveEmbeddedChallenge', () => {
  it('reports a moved intent as completed', async () => {
    const lifecycle = fakeLifecycle(challenged())
    const handleNextAction = vi.fn(async () => ({
      paymentIntent: { status: 'processing' }
    }))

    const outcome = await driveEmbeddedChallenge(lifecycle, 'op-1', {
      handleNextAction
    })

    expect(outcome).toBe('completed')
    expect(handleNextAction).toHaveBeenCalledWith('pi_secret')
    expect(lifecycle.reportChallengeStarted).toHaveBeenCalledWith('op-1')
    expect(lifecycle.reportChallengeSettled).toHaveBeenCalledWith(
      'op-1',
      'completed'
    )
  })

  it('reports an error, an unmoved intent, or a throw as failed', async () => {
    for (const handleNextAction of [
      async () => ({ error: { code: 'card_declined' } }),
      async () => ({ paymentIntent: { status: 'requires_action' } }),
      async () => {
        throw new Error('network')
      }
    ]) {
      const lifecycle = fakeLifecycle(challenged())
      await expect(
        driveEmbeddedChallenge(lifecycle, 'op-1', { handleNextAction })
      ).resolves.toBe('failed')
      expect(lifecycle.reportChallengeSettled).toHaveBeenCalledWith(
        'op-1',
        'failed'
      )
    }
  })

  it('does nothing without a required challenge on an embedded pending operation', async () => {
    const handleNextAction = vi.fn(async () => ({}))
    for (const state of [
      undefined,
      challenged({ presentation: 'hosted' }),
      challenged({ challenge: undefined }),
      challenged({
        challenge: { clientSecret: 'pi_secret', status: 'in_progress' }
      })
    ]) {
      const lifecycle = fakeLifecycle(state)
      await expect(
        driveEmbeddedChallenge(lifecycle, 'op-1', { handleNextAction })
      ).resolves.toBe('not_required')
      expect(lifecycle.reportChallengeStarted).not.toHaveBeenCalled()
    }
    expect(handleNextAction).not.toHaveBeenCalled()
  })
})
