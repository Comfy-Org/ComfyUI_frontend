import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { reportError } from '@/platform/telemetry/reportError'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApiError'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'

import { useRetentionOffer } from './useRetentionOffer'

vi.mock(import('@/composables/billing/useBillingContext'))
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
  beforeEach(() => {
    vi.mocked(useBillingContext).mockReturnValue(useBillingContext())
  })

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

  it('applies an acceptance the server already settled without polling', async () => {
    vi.mocked(workspaceApi.acceptRetentionOffer).mockResolvedValue({
      billing_op_id: 'op-retention',
      status: 'succeeded'
    })
    const { phase, accept } = useRetentionOffer('session-1', 'workspace-1')

    await accept()

    expect(phase.value).toBe('applied')
    expect(useBillingOperationStore().startOperation).not.toHaveBeenCalled()
    expect(useBillingContext().fetchStatus).toHaveBeenCalledOnce()
  })

  it('tells the owner to refresh when the applied plan cannot be reloaded', async () => {
    settlesAs('succeeded')
    const error = new Error('status unavailable')
    vi.mocked(useBillingContext().fetchStatus).mockRejectedValue(error)
    const { phase, accept } = useRetentionOffer('session-1', 'workspace-1')

    await accept()

    expect(phase.value).toBe('applied')
    expect(reportError).toHaveBeenCalledExactlyOnceWith(error, {
      surface: 'billing',
      errorType: 'error_refreshing_billing_after_retention_discount'
    })
    expect(useToast().toasts).toContainEqual(
      expect.objectContaining({ kind: 'warning' })
    )
  })

  it.for([
    { status: 'failed', phase: 'declined' },
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

  it.for([
    { status: 400, code: undefined, phase: 'failed' },
    { status: 409, code: 'SUBSCRIPTION_CHANGE_IN_PROGRESS', phase: 'failed' },
    { status: 422, code: undefined, phase: 'failed' },
    { status: 503, code: 'RETENTION_UNAVAILABLE', phase: 'failed' },
    { status: 409, code: 'RETENTION_SESSION_STALE', phase: 'expired' },
    { status: 409, code: 'RETENTION_ALREADY_REDEEMED', phase: 'expired' },
    { status: 409, code: 'PREVIOUS_OPERATION_FAILED', phase: 'declined' },
    { status: 403, code: 'RETENTION_NOT_ALLOWED', phase: 'declined' }
  ] as const)(
    'a $status $code refusal leaves the offer $phase without reporting',
    async ({ status, code, phase: expected }) => {
      vi.mocked(workspaceApi.acceptRetentionOffer).mockRejectedValue(
        new WorkspaceApiError('refused', status, code)
      )
      const { phase, accept } = useRetentionOffer('session-1', 'workspace-1')

      await accept()

      expect(phase.value).toBe(expected)
      expect(reportError).not.toHaveBeenCalled()
    }
  )

  it.for(['declined', 'expired'] as const)(
    'sends nothing more once the offer is %s',
    async (expected) => {
      vi.mocked(workspaceApi.acceptRetentionOffer).mockRejectedValue(
        new WorkspaceApiError(
          'refused',
          409,
          expected === 'declined'
            ? 'PREVIOUS_OPERATION_FAILED'
            : 'RETENTION_SESSION_STALE'
        )
      )
      const { phase, accept } = useRetentionOffer('session-1', 'workspace-1')

      await accept()
      await accept()

      expect(phase.value).toBe(expected)
      expect(workspaceApi.acceptRetentionOffer).toHaveBeenCalledOnce()
    }
  )

  it.for([
    {
      name: 'an expired session expires the offer',
      error: new WorkspaceApiError('stale', 409, 'RETENTION_SESSION_STALE'),
      phase: 'expired'
    },
    {
      name: 'a failed record keeps the offer',
      error: new WorkspaceApiError('boom', 500),
      phase: 'offered'
    }
  ])('recording the shown offer: $name', async ({ error, phase: expected }) => {
    vi.mocked(workspaceApi.recordRetentionFlowEvent).mockRejectedValue(error)
    const { phase, recordShown } = useRetentionOffer('session-1', 'workspace-1')

    await recordShown()

    expect(phase.value).toBe(expected)
  })

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
