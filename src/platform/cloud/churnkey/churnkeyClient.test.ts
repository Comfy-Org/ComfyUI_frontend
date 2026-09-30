import { CancelFlowMachine, ChurnkeyApi } from '@churnkey/react/core'
import type { ChurnkeyFlowResponse } from '@comfyorg/ingest-types'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  workspaceApi,
  WorkspaceApiError
} from '@/platform/workspace/api/workspaceApi'
import { useDialogStore } from '@/stores/dialogStore'

import { prepareChurnkey } from './churnkeyClient'

vi.mock(import('@/i18n'))
vi.mock(import('@/platform/telemetry/reportError'))
vi.mock(import('@/platform/workspace/api/workspaceApi'))

function flowResponse(): ChurnkeyFlowResponse {
  return {
    app_id: 'direct-app',
    customer_id: 'workspace-1',
    auth_hash: 'hash',
    mode: 'test',
    session_id: 'eea22c37-8d91-422c-88a5-06e096645e35',
    expires_at: Math.floor(Date.now() / 1000) + 600,
    experiment_variant: 'treatment',
    allowed_offer: { id: 'save_30_next_3_v1', percent_off: 30, renewals: 3 },
    subscription: {
      id: 'sub-1',
      price_id: 'price-1',
      started_at: 1000,
      unit_amount: 2000,
      quantity: 1,
      currency: 'usd',
      period_start: 2000,
      period_end: 3000,
      interval: 'month',
      interval_count: 1
    },
    sdk_config: {
      blueprintId: 'blueprint-1',
      customer: { id: 'workspace-1', currency: 'usd' },
      subscriptions: [
        {
          id: 'sub-1',
          customerId: 'workspace-1',
          start: '2026-01-01T00:00:00Z',
          status: {
            name: 'active',
            currentPeriod: {
              start: '2026-09-01T00:00:00Z',
              end: '2026-10-01T00:00:00Z'
            }
          },
          duration: { interval: 'month', intervalCount: 1 },
          items: [
            {
              quantity: 1,
              price: {
                id: 'price-1',
                duration: { interval: 'month', intervalCount: 1 },
                amount: { value: 2000, currency: 'usd' }
              }
            }
          ]
        }
      ],
      settings: {
        cancelAtPeriodEnd: true,
        clickToCancelEnabled: true,
        strictFTCComplianceEnabled: true
      },
      steps: [
        {
          guid: 'offer-1',
          type: 'offer',
          offer: {
            type: 'discount',
            decisionId: 'decision-1',
            percentOff: 30,
            durationInMonths: 3,
            copy: {
              headline: 'Stay',
              body: 'Save 30%',
              cta: 'Accept',
              declineCta: 'Continue'
            }
          }
        },
        { guid: 'confirm-1', type: 'confirm' }
      ]
    }
  }
}
function currentMachine() {
  const machine = useDialogStore().dialogStack.at(-1)?.contentProps.machine
  assert.instanceOf(machine, CancelFlowMachine)
  return machine
}

beforeEach(() => {
  vi.mocked(workspaceApi.prepareChurnkeyFlow).mockResolvedValue(flowResponse())
  vi.spyOn(ChurnkeyApi.prototype, 'createSession').mockResolvedValue()
})

describe('Cloud-authorized core flow', () => {
  it('uses the prepared hosted config and reports success only after Cloud confirms', async () => {
    type Acceptance = Awaited<
      ReturnType<typeof workspaceApi.acceptChurnkeyRetention>
    >
    let confirm: ((acceptance: Acceptance) => void) | undefined
    const acceptance = new Promise<Acceptance>((resolve) => {
      confirm = resolve
    })
    vi.mocked(workspaceApi.acceptChurnkeyRetention).mockReturnValue(acceptance)
    const session = await prepareChurnkey()
    assert.exists(session)
    const handleCancel = vi.fn().mockResolvedValue({})
    const completion = session.show({
      workspaceId: 'workspace-1',
      handleCancel
    })
    const machine = currentMachine()
    const action = machine.accept()
    await vi.waitFor(() =>
      expect(workspaceApi.acceptChurnkeyRetention).toHaveBeenCalledWith(
        'eea22c37-8d91-422c-88a5-06e096645e35'
      )
    )
    expect(machine.getSnapshot().outcome).toBeNull()
    assert.exists(confirm)
    confirm({ billing_op_id: 'retention-1', status: 'succeeded' })
    await action
    expect(machine.getSnapshot().outcome).toBe('saved')
    useDialogStore().closeDialog({
      key: 'churnkey-eea22c37-8d91-422c-88a5-06e096645e35'
    })
    await expect(completion).resolves.toEqual({ type: 'discount-applied' })
    expect(handleCancel).not.toHaveBeenCalled()
  })
  it('keeps a lost acceptance response from falling through to cancellation', async () => {
    vi.mocked(workspaceApi.acceptChurnkeyRetention).mockRejectedValue(
      new WorkspaceApiError('Network interrupted')
    )
    const session = await prepareChurnkey()
    assert.exists(session)
    const handleCancel = vi.fn().mockResolvedValue({})
    const completion = session.show({ handleCancel })
    const machine = currentMachine()
    await machine.accept()
    await machine.cancel()
    expect(handleCancel).not.toHaveBeenCalled()
    expect(machine.getSnapshot().outcome).toBeNull()
    useDialogStore().closeDialog({
      key: 'churnkey-eea22c37-8d91-422c-88a5-06e096645e35'
    })
    await expect(completion).resolves.toEqual({ type: 'billing-pending' })
  })
  it('can recover a lost response through the same session without another billing action', async () => {
    vi.mocked(workspaceApi.acceptChurnkeyRetention)
      .mockRejectedValueOnce(new WorkspaceApiError('Interrupted'))
      .mockResolvedValueOnce({
        billing_op_id: 'retention-1',
        status: 'succeeded'
      })
    const session = await prepareChurnkey()
    assert.exists(session)
    const completion = session.show({ handleCancel: vi.fn() })
    const machine = currentMachine()
    await machine.accept()
    await machine.accept()
    expect(machine.getSnapshot().outcome).toBe('saved')
    expect(workspaceApi.acceptChurnkeyRetention).toHaveBeenNthCalledWith(
      1,
      'eea22c37-8d91-422c-88a5-06e096645e35'
    )
    expect(workspaceApi.acceptChurnkeyRetention).toHaveBeenNthCalledWith(
      2,
      'eea22c37-8d91-422c-88a5-06e096645e35'
    )
    useDialogStore().closeDialog({
      key: 'churnkey-eea22c37-8d91-422c-88a5-06e096645e35'
    })
    await expect(completion).resolves.toEqual({ type: 'discount-applied' })
  })
  it('rejects a billing action when the active workspace has changed', async () => {
    const session = await prepareChurnkey()
    assert.exists(session)
    const completion = session.show({
      isWorkspaceCurrent: () => false,
      handleCancel: vi.fn()
    })
    await currentMachine().accept()
    expect(workspaceApi.acceptChurnkeyRetention).not.toHaveBeenCalled()
    useDialogStore().closeDialog({
      key: 'churnkey-eea22c37-8d91-422c-88a5-06e096645e35'
    })
    await expect(completion).resolves.toEqual({ type: 'abandoned' })
  })
  it('degrades to the existing cancellation dialog while Direct is disabled', async () => {
    vi.mocked(workspaceApi.prepareChurnkeyFlow).mockRejectedValue(
      new WorkspaceApiError('Disabled', 503)
    )
    await expect(prepareChurnkey()).resolves.toBeNull()
  })
})
