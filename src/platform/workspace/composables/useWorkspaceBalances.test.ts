import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useWorkspaceBalances } from './useWorkspaceBalances'

const mocks = vi.hoisted(() => ({
  peekWorkspaceToken: vi.fn<(id: string) => Promise<string | null>>(),
  getBillingBalanceWithToken: vi.fn()
}))

vi.mock('@/platform/workspace/stores/workspaceAuthStore', () => ({
  useWorkspaceAuthStore: () => ({
    peekWorkspaceToken: mocks.peekWorkspaceToken
  })
}))

vi.mock('@/platform/workspace/api/workspaceApi', () => ({
  workspaceApi: {
    getBillingBalanceWithToken: mocks.getBillingBalanceWithToken
  }
}))

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('useWorkspaceBalances', () => {
  beforeEach(() => {
    mocks.peekWorkspaceToken.mockReset()
    mocks.getBillingBalanceWithToken.mockReset()
  })

  it('resolves a balance through a peeked token', async () => {
    mocks.peekWorkspaceToken.mockResolvedValue('token-a')
    mocks.getBillingBalanceWithToken.mockResolvedValue({
      amount_micros: 500,
      effective_balance_micros: 1000
    })
    const { balanceByWorkspaceId, loadBalances } = useWorkspaceBalances()

    loadBalances(['ws-resolve'])
    await settle()

    expect(mocks.peekWorkspaceToken).toHaveBeenCalledWith('ws-resolve')
    expect(mocks.getBillingBalanceWithToken).toHaveBeenCalledWith('token-a')
    expect(balanceByWorkspaceId['ws-resolve']).toEqual({
      status: 'ready',
      cents: 1000
    })
  })

  it('fails closed when no token can be minted', async () => {
    mocks.peekWorkspaceToken.mockResolvedValue(null)
    const { balanceByWorkspaceId, loadBalances } = useWorkspaceBalances()

    loadBalances(['ws-no-token'])
    await settle()

    expect(balanceByWorkspaceId['ws-no-token']).toEqual({ status: 'error' })
    expect(mocks.getBillingBalanceWithToken).not.toHaveBeenCalled()
  })

  it('records an error when the balance fetch fails', async () => {
    mocks.peekWorkspaceToken.mockResolvedValue('token-b')
    mocks.getBillingBalanceWithToken.mockRejectedValue(new Error('boom'))
    const { balanceByWorkspaceId, loadBalances } = useWorkspaceBalances()

    loadBalances(['ws-fetch-fails'])
    await settle()

    expect(balanceByWorkspaceId['ws-fetch-fails']).toEqual({ status: 'error' })
  })

  it('serves a fresh balance from cache instead of re-minting', async () => {
    mocks.peekWorkspaceToken.mockResolvedValue('token-c')
    mocks.getBillingBalanceWithToken.mockResolvedValue({
      amount_micros: 200,
      effective_balance_micros: 200
    })
    const { loadBalances } = useWorkspaceBalances()

    loadBalances(['ws-cached'])
    await settle()
    loadBalances(['ws-cached'])
    await settle()

    expect(mocks.peekWorkspaceToken).toHaveBeenCalledTimes(1)
  })
})
