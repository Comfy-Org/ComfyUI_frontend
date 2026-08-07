import type {
  AcceptInviteResponse,
  BillingBalanceResponse,
  BillingEventsResponse,
  BillingOpStatusResponse,
  BillingPlansResponse as GeneratedBillingPlansResponse,
  BillingStatus,
  BillingStatusResponse as GeneratedBillingStatusResponse,
  CancelSubscriptionRequest,
  CancelSubscriptionResponse,
  ChurnkeyAuthResponse,
  CreateInviteRequest,
  CreateTopupRequest,
  CreateTopupResponse,
  CreateWorkspaceRequest,
  ListInvitesResponse,
  ListMembersResponse,
  ListWorkspacesResponse as GeneratedListWorkspacesResponse,
  Member as GeneratedMember,
  PaymentPortalRequest,
  PaymentPortalResponse,
  PendingInvite,
  Plan as GeneratedPlan,
  PreviewSubscribeRequest as GeneratedPreviewSubscribeRequest,
  PreviewSubscribeResponse,
  ResubscribeRequest,
  ResubscribeResponse,
  SubscribeRequest,
  SubscribeResponse,
  SubscriptionDuration,
  TeamCreditStops,
  TeamCreditStopSummary,
  UpdateWorkspaceRequest,
  WorkspaceWithRole as GeneratedWorkspaceWithRole
} from '@comfyorg/ingest-types'
import axios from 'axios'

import { attachUnifiedRemintInterceptor } from '@/platform/auth/unified/remintRetry'
import { churnkeyAuthResponseSchema } from '@/platform/cloud/churnkey/churnkeyAuthSchema'
import type { SubscriptionTier } from '@/platform/cloud/subscription/constants/tierPricing'
import type {
  WorkspaceId,
  WorkspaceInviteId
} from '@/platform/workspace/workspaceTypes'
import { api } from '@/scripts/api'
import { useAuthStore } from '@/stores/authStore'
import type { UserId } from '@/types/authTypes'

export type WorkspaceType = 'personal' | 'team'
export type WorkspaceRole = 'owner' | 'member'
export type BillingRail = NonNullable<
  GeneratedBillingStatusResponse['billing_rail']
>

export type WorkspaceWithRole = Omit<
  GeneratedWorkspaceWithRole,
  'subscription_tier'
> & {
  // Uses the registry's SubscriptionTier (no TEAM) to match how the rest of
  // the app threads subscription_tier through personal-plan pricing;
  // workspace.type distinguishes team workspaces instead.
  subscription_tier?: SubscriptionTier
}

export type ListWorkspacesResponse = Omit<
  GeneratedListWorkspacesResponse,
  'workspaces'
> & { workspaces: WorkspaceWithRole[] }

export type Member = GeneratedMember & {
  // Per-member monthly credit limit UI (FE-1277). The cloud OpenAPI carries
  // neither usage nor limit yet; persistence and real usage land in FE-1278.
  credits_used_this_month?: number
  monthly_credit_limit?: number | null
}

export interface ListMembersParams {
  offset?: number
  limit?: number
}

export type { PendingInvite }

export type { SubscriptionTier }
export type { SubscriptionDuration }

// Uses the registry's SubscriptionTier (no TEAM); the personal plan catalog
// never lists team plans.
export type Plan = Omit<GeneratedPlan, 'tier'> & { tier: SubscriptionTier }
export type BillingPlansResponse = Omit<
  GeneratedBillingPlansResponse,
  'plans'
> & { plans: Plan[] }
export type { TeamCreditStops }
export type { TeamCreditStopSummary }

type SubscribeBillingCycle = 'monthly' | 'yearly'

type PreviewSubscribeRequest = GeneratedPreviewSubscribeRequest & {
  billing_cycle?: SubscribeBillingCycle
}

export interface SubscribeOptions {
  returnUrl?: string
  cancelUrl?: string
  teamCreditStopId?: string
  billingCycle?: SubscribeBillingCycle
  confirmReactivation?: boolean
  prorationAt?: string
}

export interface PreviewSubscribeOptions {
  teamCreditStopId?: string
  billingCycle?: SubscribeBillingCycle
}

export type { SubscribeResponse }

export type { PreviewSubscribeResponse }

export type BillingSubscriptionStatus = NonNullable<
  GeneratedBillingStatusResponse['subscription_status']
>

export type { BillingStatus }

export type BillingStatusResponse = Omit<
  GeneratedBillingStatusResponse,
  'max_seats' | 'occupied_seats' | 'subscription_tier' | 'team_credit_stop'
> & {
  // The spec marks these required, but older/billing-disabled deployments
  // can omit them; getBillingStatus() normalizes a missing value to null.
  max_seats?: number | null
  occupied_seats?: number | null
  // Uses the registry's SubscriptionTier (no TEAM), matching WorkspaceWithRole.
  subscription_tier?: SubscriptionTier
  // The spec marks this required (always present, nullable); kept optional
  // here to match how existing callers already read it defensively.
  team_credit_stop?: TeamCreditStopSummary | null
  // Not yet part of the ingest OpenAPI spec; scheduled-plan-change display
  // ships ahead of the backend documenting these fields.
  scheduled_plan_slug?: string
  change_at?: string
}

export type { BillingBalanceResponse }
export type { CreateTopupResponse }
export type { BillingOpStatusResponse }

interface GetBillingEventsParams {
  page?: number
  limit?: number
}

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

const workspaceApiClient = axios.create({
  headers: {
    'Content-Type': 'application/json'
  }
})

// acceptInvite opts out via __skipUnifiedRemint (it is deliberately Firebase-authed).
attachUnifiedRemintInterceptor(workspaceApiClient)

async function getAuthHeaderOrThrow() {
  return useAuthStore().getAuthHeaderOrThrow()
}

function handleAxiosError(err: unknown): never {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status
    const message = err.response?.data?.message ?? err.message
    // Response data is untyped: keep a non-string code out of the string
    // contract, so callers comparing against it cannot match on a surprise.
    const rawCode: unknown = err.response?.data?.code
    const code = typeof rawCode === 'string' ? rawCode : undefined
    throw new WorkspaceApiError(message, status, code)
  }
  throw err
}

export const workspaceApi = {
  /**
   * List all workspaces the user has access to
   * GET /api/workspaces
   */
  async list(): Promise<ListWorkspacesResponse> {
    const headers = await getAuthHeaderOrThrow()
    try {
      const response = await workspaceApiClient.get<ListWorkspacesResponse>(
        api.apiURL('/workspaces'),
        { headers }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err)
    }
  },

  /**
   * Create a new workspace
   * POST /api/workspaces
   */
  async create(payload: CreateWorkspaceRequest): Promise<WorkspaceWithRole> {
    const headers = await getAuthHeaderOrThrow()
    try {
      const response = await workspaceApiClient.post<WorkspaceWithRole>(
        api.apiURL('/workspaces'),
        payload,
        { headers }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err)
    }
  },

  /**
   * Update workspace name
   * PATCH /api/workspaces/:id
   */
  async update(
    workspaceId: WorkspaceId,
    payload: UpdateWorkspaceRequest
  ): Promise<WorkspaceWithRole> {
    const headers = await getAuthHeaderOrThrow()
    try {
      const response = await workspaceApiClient.patch<WorkspaceWithRole>(
        api.apiURL(`/workspaces/${workspaceId}`),
        payload,
        { headers }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err)
    }
  },

  /**
   * Delete a workspace (owner only)
   * DELETE /api/workspaces/:id
   */
  async delete(workspaceId: WorkspaceId): Promise<void> {
    const headers = await getAuthHeaderOrThrow()
    try {
      await workspaceApiClient.delete(
        api.apiURL(`/workspaces/${workspaceId}`),
        {
          headers
        }
      )
    } catch (err) {
      handleAxiosError(err)
    }
  },

  /**
   * Leave the current workspace.
   * POST /api/workspace/leave
   */
  async leave(): Promise<void> {
    const headers = await getAuthHeaderOrThrow()
    try {
      await workspaceApiClient.post(api.apiURL('/workspace/leave'), null, {
        headers
      })
    } catch (err) {
      handleAxiosError(err)
    }
  },

  /**
   * List workspace members (paginated).
   * GET /api/workspace/members
   */
  async listMembers(params?: ListMembersParams): Promise<ListMembersResponse> {
    const headers = await getAuthHeaderOrThrow()
    try {
      const response = await workspaceApiClient.get<ListMembersResponse>(
        api.apiURL('/workspace/members'),
        { headers, params }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err)
    }
  },

  /**
   * Remove a member from the workspace.
   * DELETE /api/workspace/members/:userId
   */
  async removeMember(userId: UserId): Promise<void> {
    const headers = await getAuthHeaderOrThrow()
    try {
      await workspaceApiClient.delete(
        api.apiURL(`/workspace/members/${userId}`),
        { headers }
      )
    } catch (err) {
      handleAxiosError(err)
    }
  },

  /**
   * Change a member's role (member ↔ owner).
   * PATCH /api/workspace/members/:userId
   */
  async updateMemberRole(userId: UserId, role: WorkspaceRole): Promise<Member> {
    const headers = await getAuthHeaderOrThrow()
    try {
      const response = await workspaceApiClient.patch<Member>(
        api.apiURL(`/workspace/members/${userId}`),
        { role },
        { headers }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err)
    }
  },

  /**
   * List pending invites for the workspace.
   * GET /api/workspace/invites
   */
  async listInvites(): Promise<ListInvitesResponse> {
    const headers = await getAuthHeaderOrThrow()
    try {
      const response = await workspaceApiClient.get<ListInvitesResponse>(
        api.apiURL('/workspace/invites'),
        { headers }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err)
    }
  },

  /**
   * Create an invite for the workspace.
   * POST /api/workspace/invites
   */
  async createInvite(payload: CreateInviteRequest): Promise<PendingInvite> {
    const headers = await getAuthHeaderOrThrow()
    try {
      const response = await workspaceApiClient.post<PendingInvite>(
        api.apiURL('/workspace/invites'),
        payload,
        { headers }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err)
    }
  },

  /**
   * Revoke a pending invite.
   * DELETE /api/workspace/invites/:inviteId
   */
  async revokeInvite(inviteId: WorkspaceInviteId): Promise<void> {
    const headers = await getAuthHeaderOrThrow()
    try {
      await workspaceApiClient.delete(
        api.apiURL(`/workspace/invites/${inviteId}`),
        { headers }
      )
    } catch (err) {
      handleAxiosError(err)
    }
  },

  async resendInvite(inviteId: WorkspaceInviteId): Promise<PendingInvite> {
    const headers = await getAuthHeaderOrThrow()
    try {
      const response = await workspaceApiClient.post<PendingInvite>(
        api.apiURL(`/workspace/invites/${encodeURIComponent(inviteId)}/resend`),
        null,
        { headers }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err)
    }
  },

  /**
   * Accept a workspace invite.
   * POST /api/invites/:token/accept
   * Uses Firebase auth (user identity) since the user isn't yet a workspace member.
   */
  async acceptInvite(token: string): Promise<AcceptInviteResponse> {
    const headers = await useAuthStore().getFirebaseAuthHeaderOrThrow()
    try {
      const response = await workspaceApiClient.post<AcceptInviteResponse>(
        api.apiURL(`/invites/${token}/accept`),
        null,
        { headers, __skipUnifiedRemint: true }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err)
    }
  },

  /**
   * Get billing status for the current workspace
   * GET /api/billing/status
   */
  async getBillingStatus(): Promise<BillingStatusResponse> {
    const headers = await getAuthHeaderOrThrow()
    try {
      const response = await workspaceApiClient.get<BillingStatusResponse>(
        api.apiURL('/billing/status'),
        { headers }
      )
      return {
        ...response.data,
        max_seats: response.data.max_seats ?? null,
        occupied_seats: response.data.occupied_seats ?? null
      }
    } catch (err) {
      handleAxiosError(err)
    }
  },

  /**
   * Get credit balance for the current workspace
   * GET /api/billing/balance
   */
  async getBillingBalance(): Promise<BillingBalanceResponse> {
    const headers = await getAuthHeaderOrThrow()
    try {
      const response = await workspaceApiClient.get<BillingBalanceResponse>(
        api.apiURL('/billing/balance'),
        { headers }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err)
    }
  },

  /**
   * Get available subscription plans
   * GET /api/billing/plans
   */
  async getBillingPlans(): Promise<BillingPlansResponse> {
    const headers = await getAuthHeaderOrThrow()
    try {
      const response = await workspaceApiClient.get<BillingPlansResponse>(
        api.apiURL('/billing/plans'),
        { headers }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err)
    }
  },

  /**
   * Preview subscription change
   * POST /api/billing/preview-subscribe
   */
  async previewSubscribe(
    planSlug: string,
    options: PreviewSubscribeOptions = {}
  ): Promise<PreviewSubscribeResponse> {
    const headers = await getAuthHeaderOrThrow()
    try {
      const response = await workspaceApiClient.post<PreviewSubscribeResponse>(
        api.apiURL('/billing/preview-subscribe'),
        {
          plan_slug: planSlug,
          team_credit_stop_id: options.teamCreditStopId,
          billing_cycle: options.billingCycle
        } satisfies PreviewSubscribeRequest,
        { headers }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err)
    }
  },

  /**
   * Subscribe to a billing plan
   * POST /api/billing/subscribe
   */
  async subscribe(
    planSlug: string,
    options: SubscribeOptions = {}
  ): Promise<SubscribeResponse> {
    const headers = await getAuthHeaderOrThrow()
    try {
      const response = await workspaceApiClient.post<SubscribeResponse>(
        api.apiURL('/billing/subscribe'),
        {
          plan_slug: planSlug,
          return_url: options.returnUrl,
          cancel_url: options.cancelUrl,
          team_credit_stop_id: options.teamCreditStopId,
          billing_cycle: options.billingCycle,
          confirm_reactivation: options.confirmReactivation,
          proration_at: options.prorationAt
        } satisfies SubscribeRequest,
        { headers }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err)
    }
  },

  /**
   * Cancel current subscription
   * POST /api/billing/subscription/cancel
   */
  async cancelSubscription(
    idempotencyKey?: string
  ): Promise<CancelSubscriptionResponse> {
    const headers = await getAuthHeaderOrThrow()
    try {
      const response =
        await workspaceApiClient.post<CancelSubscriptionResponse>(
          api.apiURL('/billing/subscription/cancel'),
          {
            idempotency_key: idempotencyKey
          } satisfies CancelSubscriptionRequest,
          { headers }
        )
      return response.data
    } catch (err) {
      handleAxiosError(err)
    }
  },

  async getChurnkeyAuth(): Promise<ChurnkeyAuthResponse> {
    const headers = await getAuthHeaderOrThrow()
    try {
      const response = await workspaceApiClient.get<unknown>(
        api.apiURL('/billing/churnkey/auth'),
        { headers }
      )
      return churnkeyAuthResponseSchema.parse(response.data)
    } catch (err) {
      handleAxiosError(err)
    }
  },

  /**
   * Resubscribe (undo cancel) before period ends
   * POST /api/billing/subscription/resubscribe
   */
  async resubscribe(idempotencyKey?: string): Promise<ResubscribeResponse> {
    const headers = await getAuthHeaderOrThrow()
    try {
      const response = await workspaceApiClient.post<ResubscribeResponse>(
        api.apiURL('/billing/subscription/resubscribe'),
        { idempotency_key: idempotencyKey } satisfies ResubscribeRequest,
        { headers }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err)
    }
  },

  /**
   * Get Stripe payment portal URL for managing payment methods
   * POST /api/billing/payment-portal
   */
  async getPaymentPortalUrl(
    returnUrl?: string
  ): Promise<PaymentPortalResponse> {
    const headers = await getAuthHeaderOrThrow()
    try {
      const response = await workspaceApiClient.post<PaymentPortalResponse>(
        api.apiURL('/billing/payment-portal'),
        { return_url: returnUrl } satisfies PaymentPortalRequest,
        { headers }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err)
    }
  },

  /**
   * Create a credit top-up
   * POST /api/billing/topup
   */
  async createTopup(
    amountCents: number,
    idempotencyKey?: string
  ): Promise<CreateTopupResponse> {
    const headers = await getAuthHeaderOrThrow()
    try {
      const response = await workspaceApiClient.post<CreateTopupResponse>(
        api.apiURL('/billing/topup'),
        {
          amount_cents: amountCents,
          idempotency_key: idempotencyKey
        } satisfies CreateTopupRequest,
        { headers }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err)
    }
  },

  /**
   * Get billing events
   * GET /api/billing/events
   */
  async getBillingEvents(
    params?: GetBillingEventsParams
  ): Promise<BillingEventsResponse> {
    const headers = await getAuthHeaderOrThrow()
    try {
      const response = await workspaceApiClient.get<BillingEventsResponse>(
        api.apiURL('/billing/events'),
        { headers, params }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err)
    }
  },

  /**
   * Get billing operation status
   * GET /api/billing/ops/:id
   */
  async getBillingOpStatus(opId: string): Promise<BillingOpStatusResponse> {
    const headers = await getAuthHeaderOrThrow()
    try {
      const response = await workspaceApiClient.get<BillingOpStatusResponse>(
        api.apiURL(`/billing/ops/${opId}`),
        { headers, timeout: 30_000 }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err)
    }
  }
}
