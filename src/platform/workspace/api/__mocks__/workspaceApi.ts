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

export const workspaceApi = vi.mockObject<typeof realWorkspaceApi>(
  {
    list: async () => ({ workspaces: [] }),
    getCurrentWorkspace: async () => ({
      id: 'workspace-1',
      name: 'Personal',
      type: 'personal',
      role: 'owner',
      auth_method: 'cloud_jwt'
    }),
    create: async ({ name }) => ({
      id: 'workspace-1',
      name,
      type: 'team',
      role: 'owner',
      created_at: '2026-01-01T00:00:00Z',
      joined_at: '2026-01-01T00:00:00Z'
    }),
    update: async (id, { name }) => ({
      id,
      name: name ?? 'Team',
      type: 'team',
      role: 'owner',
      created_at: '2026-01-01T00:00:00Z',
      joined_at: '2026-01-01T00:00:00Z'
    }),
    delete: async () => {},
    leave: async () => {},
    listMembers: async () => ({
      members: [],
      pagination: { has_more: false, limit: 20, offset: 0, total: 0 }
    }),
    removeMember: async () => {},
    updateMemberRole: async (id, role) => ({
      id,
      role,
      name: 'Member',
      email: 'member@example.com',
      is_original_owner: false,
      joined_at: '2026-01-01T00:00:00Z'
    }),
    listInvites: async () => ({ invites: [] }),
    createInvite: async ({ email }) => ({
      id: 'invite-1',
      email,
      invited_at: '2026-01-01T00:00:00Z',
      expires_at: '2026-01-08T00:00:00Z'
    }),
    revokeInvite: async () => {},
    resendInvite: async (id) => ({
      id,
      email: 'member@example.com',
      invited_at: '2026-01-01T00:00:00Z',
      expires_at: '2026-01-08T00:00:00Z'
    }),
    acceptInvite: async () => ({
      workspace_id: 'workspace-1',
      workspace_name: 'Team'
    }),
    getBillingStatus: async () => ({
      is_active: false,
      has_funds: false,
      subscription_tier: 'FREE',
      max_seats: 1,
      occupied_seats: 1,
      scheduled_change: null,
      team_credit_stop: null
    }),
    getBillingBalance: async () => ({
      amount_micros: 0,
      currency: 'USD'
    }),
    getBillingCapabilities: async (signal) => {
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
    },
    getBillingPlans: async () => ({ plans: [] }),
    listSavedPaymentMethods: async () => [],
    previewSubscribe: async (slug) => ({
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
    }),
    subscribe: async () => ({
      billing_op_id: 'op-1',
      status: 'subscribed'
    }),
    cancelSubscription: async () => ({
      billing_op_id: 'op-1',
      cancel_at: '2026-02-01T00:00:00Z'
    }),
    getChurnkeyAuth: async () => ({
      auth_hash: 'test-hash',
      customer_id: 'customer-1',
      mode: 'test'
    }),
    resubscribe: async () => ({
      billing_op_id: 'op-1',
      status: 'active'
    }),
    getPaymentPortalUrl: async () => ({ url: '' }),
    createTopup: async (amount_cents) => ({
      amount_cents,
      billing_op_id: 'op-1',
      topup_id: 'op-1',
      status: 'completed'
    }),
    getBillingEvents: async () => ({
      events: [],
      limit: 20,
      page: 1,
      total: 0,
      totalPages: 0
    }),
    getBillingOpStatus: async (id) => ({
      id,
      started_at: '2026-01-01T00:00:00Z',
      status: 'succeeded'
    })
  },
  { spy: true }
)
