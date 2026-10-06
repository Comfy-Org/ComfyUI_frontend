import { describe, expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApiError'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'

import { useRetentionOffer } from './useRetentionOffer'

vi.mock(import('@/platform/workspace/api/workspaceApi'))
vi.mock(import('@/platform/telemetry/reportError'))

type TerminalOperation = Awaited<
  ReturnType<ReturnType<typeof useBillingOperationStore>['startOperation']>
>

function settlesAs(status: TerminalOperation['status']) {
  vi.mocked(useBillingOperationStore().startOperation).mockImplementation(
    async (opId, type, metadata): Promise<TerminalOperation> => ({
      opId,
      type,
      status,
      errorMessage: null,
      startedAt: 0,
      operationStartedAt: 0,
      actionUrl: null,
      authenticationState: null,
      isAuthenticating: false,
      canRetryAuthentication: false,
      authenticationRequiredSeen: false,
      blockedOnCustomerSeen: false,
      workspaceId: metadata?.workspaceId ?? null,
      autoHandleRequiresAction: false,
      phase: null,
      dismissed: false
    })
  )
}

describe('useRetentionOffer', () => {
  it('redeems through the session and polls the operation for the launch workspace', async () => {
    settlesAs('succeeded')
    const { phase, accept } = useRetentionOffer('session-1', 'workspace-1')

    await accept()

    expect(phase.value).toBe('applied')
    expect(workspaceApi.acceptRetentionOffer).toHaveBeenCalledExactlyOnceWith(
      'session-1'
    )
    expect(
      useBillingOperationStore().startOperation
    ).toHaveBeenCalledExactlyOnceWith('op-retention', 'retention', {
      workspaceId: 'workspace-1'
    })
  })

  it.for([
    { status: 'failed', phase: 'failed' },
    { status: 'timeout', phase: 'unconfirmed' },
    { status: 'reconciliation_needed', phase: 'unconfirmed' }
  ] as const)(
    'a $status operation leaves the offer $phase',
    async ({ status, phase: expected }) => {
      settlesAs(status)
      const { phase, accept } = useRetentionOffer('session-1', 'workspace-1')

      await accept()

      expect(phase.value).toBe(expected)
    }
  )

  it.for([400, 403, 409, 422, 503])(
    'a %i refusal fails without reporting an unknown outcome',
    async (status) => {
      vi.mocked(workspaceApi.acceptRetentionOffer).mockRejectedValue(
        new WorkspaceApiError('refused', status, 'RETENTION_SESSION_STALE')
      )
      const { phase, accept } = useRetentionOffer('session-1', 'workspace-1')

      await accept()

      expect(phase.value).toBe('failed')
      expect(reportError).not.toHaveBeenCalled()
    }
  )

  it.for([
    { name: 'a server error', error: new WorkspaceApiError('boom', 500) },
    { name: 'a lost response', error: new Error('Network Error') }
  ])('$name leaves the outcome unconfirmed', async ({ error }) => {
    vi.mocked(workspaceApi.acceptRetentionOffer).mockRejectedValue(error)
    const { phase, accept } = useRetentionOffer('session-1', 'workspace-1')

    await accept()

    expect(phase.value).toBe('unconfirmed')
    expect(reportError).toHaveBeenCalledOnce()
  })

  it('checks an unconfirmed outcome again with the same session', async () => {
    vi.mocked(workspaceApi.acceptRetentionOffer).mockRejectedValueOnce(
      new Error('Network Error')
    )
    settlesAs('succeeded')
    const { phase, accept } = useRetentionOffer('session-1', 'workspace-1')

    await accept()
    await accept()

    expect(phase.value).toBe('applied')
    expect(workspaceApi.acceptRetentionOffer).toHaveBeenNthCalledWith(
      2,
      'session-1'
    )
  })

  it('sends one redemption for repeated accepts', async () => {
    settlesAs('succeeded')
    const { accept } = useRetentionOffer('session-1', 'workspace-1')

    await Promise.all([accept(), accept()])

    expect(workspaceApi.acceptRetentionOffer).toHaveBeenCalledOnce()
  })

  it('tries a refused offer again with the same session', async () => {
    vi.mocked(workspaceApi.acceptRetentionOffer).mockRejectedValueOnce(
      new WorkspaceApiError('refused', 409)
    )
    settlesAs('succeeded')
    const { phase, accept } = useRetentionOffer('session-1', 'workspace-1')

    await accept()
    expect(phase.value).toBe('failed')
    await accept()

    expect(phase.value).toBe('applied')
    expect(workspaceApi.acceptRetentionOffer).toHaveBeenNthCalledWith(
      2,
      'session-1'
    )
  })

  it('does not redeem again once the discount is applied', async () => {
    settlesAs('succeeded')
    const { phase, accept } = useRetentionOffer('session-1', 'workspace-1')

    await accept()
    await accept()

    expect(phase.value).toBe('applied')
    expect(workspaceApi.acceptRetentionOffer).toHaveBeenCalledOnce()
  })
})
