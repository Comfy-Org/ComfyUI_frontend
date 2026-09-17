import { vi } from 'vitest'

import type { workspaceApi as realWorkspaceApi } from '../workspaceApi'

export class WorkspaceApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string
  ) {
    super(message)
    this.name = 'WorkspaceApiError'
  }
}

export const workspaceApi: typeof realWorkspaceApi = {
  list: vi.fn(async () => ({ workspaces: [] })),
  getCurrentWorkspace: vi.fn<typeof realWorkspaceApi.getCurrentWorkspace>(
    async () => ({
      id: 'workspace-1',
      name: 'Personal',
      type: 'personal',
      role: 'owner',
      auth_method: 'cloud_jwt'
    })
  ),
  create: vi.fn<typeof realWorkspaceApi.create>(async ({ name }) => ({
    id: 'workspace-1',
    name,
    type: 'team',
    role: 'owner',
    created_at: '2026-01-01T00:00:00Z',
    joined_at: '2026-01-01T00:00:00Z'
  })),
  update: vi.fn<typeof realWorkspaceApi.update>(async (id, { name }) => ({
    id,
    name: name ?? 'Team',
    type: 'team',
    role: 'owner',
    created_at: '2026-01-01T00:00:00Z',
    joined_at: '2026-01-01T00:00:00Z'
  })),
  delete: vi.fn(async () => {}),
  leave: vi.fn(async () => {}),
  listMembers: vi.fn(async () => ({
    members: [],
    pagination: { has_more: false, limit: 20, offset: 0, total: 0 }
  })),
  removeMember: vi.fn(async () => {}),
  updateMemberRole: vi.fn<typeof realWorkspaceApi.updateMemberRole>(
    async (id, role) => ({
      id,
      role,
      name: 'Member',
      email: 'member@example.com',
      is_original_owner: false,
      joined_at: '2026-01-01T00:00:00Z'
    })
  ),
  listInvites: vi.fn(async () => ({ invites: [] })),
  createInvite: vi.fn<typeof realWorkspaceApi.createInvite>(
    async ({ email }) => ({
      id: 'invite-1',
      email,
      invited_at: '2026-01-01T00:00:00Z',
      expires_at: '2026-01-08T00:00:00Z'
    })
  ),
  revokeInvite: vi.fn(async () => {}),
  resendInvite: vi.fn<typeof realWorkspaceApi.resendInvite>(async (id) => ({
    id,
    email: 'member@example.com',
    invited_at: '2026-01-01T00:00:00Z',
    expires_at: '2026-01-08T00:00:00Z'
  })),
  acceptInvite: vi.fn(async () => ({
    workspace_id: 'workspace-1',
    workspace_name: 'Team'
  })),
  getBillingStatus: vi.fn<typeof realWorkspaceApi.getBillingStatus>(
    async () => ({
      is_active: false,
      has_funds: false,
      subscription_tier: 'FREE',
      max_seats: 1,
      occupied_seats: 1,
      scheduled_change: null,
      team_credit_stop: null
    })
  ),
  getBillingBalance: vi.fn(async () => ({
    amount_micros: 0,
    currency: 'USD'
  })),
  getBillingCapabilities: vi.fn<typeof realWorkspaceApi.getBillingCapabilities>(
    async (signal) => {
      signal?.throwIfAborted()
      return {
        capabilities: {
          can_cancel: false,
          can_change_seats: false,
          can_downgrade_to_personal: false,
          can_invite_members: false,
          can_reactivate: false,
          can_subscribe_self_serve: false,
          can_top_up: false
        },
        expires_at: '2026-01-01T00:00:00Z',
        resolved_for: { user_id: 'user-1', workspace_id: 'workspace-1' },
        revision: 0,
        rollout_defaults_applied: {
          can_downgrade_to_personal: false,
          can_subscribe_self_serve: false,
          can_top_up: false
        }
      }
    }
  ),
  getBillingPlans: vi.fn(async () => ({ plans: [] })),
  listSavedPaymentMethods: vi.fn(async () => []),
  previewSubscribe: vi.fn<typeof realWorkspaceApi.previewSubscribe>(
    async (slug) => ({
      allowed: true,
      transition_type: 'new_subscription',
      effective_at: '2026-01-01T00:00:00Z',
      is_immediate: true,
      cost_today_cents: 0,
      cost_next_period_cents: 0,
      credits_today_cents: 0,
      credits_next_period_cents: 0,
      new_plan: {
        slug,
        tier: 'FREE',
        duration: 'MONTHLY',
        price_cents: 0,
        credits_cents: 0,
        seat_summary: {
          seat_count: 1,
          total_cost_cents: 0,
          total_credits_cents: 0
        }
      }
    })
  ),
  subscribe: vi.fn<typeof realWorkspaceApi.subscribe>(async () => ({
    billing_op_id: 'op-1',
    status: 'subscribed'
  })),
  cancelSubscription: vi.fn(async () => ({
    billing_op_id: 'op-1',
    cancel_at: '2026-02-01T00:00:00Z'
  })),
  getChurnkeyAuth: vi.fn<typeof realWorkspaceApi.getChurnkeyAuth>(async () => ({
    auth_hash: 'test-hash',
    customer_id: 'customer-1',
    mode: 'test'
  })),
  resubscribe: vi.fn<typeof realWorkspaceApi.resubscribe>(async () => ({
    billing_op_id: 'op-1',
    status: 'active'
  })),
  getPaymentPortalUrl: vi.fn(async () => ({ url: '' })),
  createTopup: vi.fn<typeof realWorkspaceApi.createTopup>(
    async (amount_cents) => ({
      amount_cents,
      billing_op_id: 'op-1',
      topup_id: 'op-1',
      status: 'completed'
    })
  ),
  getBillingEvents: vi.fn(async () => ({
    events: [],
    limit: 20,
    page: 1,
    total: 0,
    totalPages: 0
  })),
  getBillingOpStatus: vi.fn<typeof realWorkspaceApi.getBillingOpStatus>(
    async (id) => ({
      id,
      started_at: '2026-01-01T00:00:00Z',
      status: 'succeeded'
    })
  )
}
