import { reactive } from 'vue'

import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'

type WorkspaceBalanceState =
  | { status: 'loading' }
  | { status: 'ready'; cents: number }
  | { status: 'error' }

const CACHE_TTL_MS = 60_000

// Module-level so reopening the switcher reuses fresh balances instead of
// re-minting a token per workspace on every open.
const balanceByWorkspaceId = reactive<Record<string, WorkspaceBalanceState>>({})
const fetchedAt: Record<string, number> = {}

/**
 * Per-workspace credit balances for the switcher rows. The balance endpoint is
 * scoped by the auth token rather than a parameter, so each non-active
 * workspace costs a read-only token mint plus a balance fetch. Replace the
 * internals with the workspace-list balance field once the backend serves one.
 */
export function useWorkspaceBalances() {
  const authStore = useWorkspaceAuthStore()

  async function loadOne(workspaceId: string): Promise<void> {
    balanceByWorkspaceId[workspaceId] = { status: 'loading' }
    const token = await authStore.peekWorkspaceToken(workspaceId)
    if (!token) {
      balanceByWorkspaceId[workspaceId] = { status: 'error' }
      return
    }
    try {
      const balance = await workspaceApi.getBillingBalanceWithToken(token)
      // API field is named _micros but contains cents (naming inconsistency)
      balanceByWorkspaceId[workspaceId] = {
        status: 'ready',
        cents: balance.effective_balance_micros ?? balance.amount_micros ?? 0
      }
      fetchedAt[workspaceId] = Date.now()
    } catch {
      balanceByWorkspaceId[workspaceId] = { status: 'error' }
    }
  }

  function loadBalances(workspaceIds: string[]): void {
    for (const id of workspaceIds) {
      const fresh =
        fetchedAt[id] !== undefined && Date.now() - fetchedAt[id] < CACHE_TTL_MS
      if (fresh || balanceByWorkspaceId[id]?.status === 'loading') continue
      void loadOne(id)
    }
  }

  return { balanceByWorkspaceId, loadBalances }
}
