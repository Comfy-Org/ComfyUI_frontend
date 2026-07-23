import axios from 'axios'

import { attachUnifiedRemintInterceptor } from '@/platform/auth/unified/remintRetry'
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
export type BillingRail = 'legacy_stripe' | 'stripe'

interface Workspace {
  id: WorkspaceId
  name: string
  type: WorkspaceType
  created_at: string
  joined_at: string
}

export interface WorkspaceWithRole extends Workspace {
  role: WorkspaceRole
  subscription_tier?: SubscriptionTier
}

export interface Member {
  id: UserId
  name: string
  email: string
  joined_at: string
  role: WorkspaceRole
  // True when this member is the workspace's original owner/creator
  // (member.id == workspace.created_by_user_id). Used for personal creator
  // protections and Team-to-personal downgrade eligibility.
  // Optional: the cloud OpenAPI does not carry this field yet.
  is_original_owner?: boolean
}

interface PaginationInfo {
  offset: number
  limit: number
  total: number
}

interface ListMembersResponse {
  members: Member[]
  pagination: PaginationInfo
}

export interface ListMembersParams {
  offset?: number
  limit?: number
}

export interface PendingInvite {
  id: WorkspaceInviteId
  email: string
  invited_at: string
  expires_at: string
}

interface ListInvitesResponse {
  invites: PendingInvite[]
}

interface CreateInviteRequest {
  email: string
}

interface AcceptInviteResponse {
  workspace_id: WorkspaceId
  workspace_name: string
}

interface CreateWorkspacePayload {
  name: string
}

interface UpdateWorkspacePayload {
  name: string
}

interface ListWorkspacesResponse {
  workspaces: WorkspaceWithRole[]
}

export type { SubscriptionTier }
export type SubscriptionDuration = 'MONTHLY' | 'ANNUAL'
type PlanAvailabilityReason =
  | 'same_plan'
  | 'incompatible_transition'
  | 'requires_team'
  | 'requires_personal'
  | 'exceeds_max_seats'

interface PlanAvailability {
  available: boolean
  reason?: PlanAvailabilityReason
}

interface PlanSeatSummary {
  seat_count: number
  total_cost_cents: number
  total_credits_cents: number
}

export interface Plan {
  slug: string
  tier: SubscriptionTier
  duration: SubscriptionDuration
  price_cents: number
  credits_cents: number
  max_seats: number
  availability: PlanAvailability
  seat_summary: PlanSeatSummary
}

interface TeamCreditStopPrice {
  list_price_cents: number
  price_cents: number
}

interface TeamCreditStop {
  id: string
  credits: number
  monthly: TeamCreditStopPrice
  yearly: TeamCreditStopPrice
}

export interface TeamCreditStops {
  default_stop_index: number
  stops: TeamCreditStop[]
}

interface BillingPlansResponse {
  current_plan_slug?: string
  plans: Plan[]
  team_credit_stops?: TeamCreditStops
}

type SubscriptionTransitionType =
  | 'new_subscription'
  | 'upgrade'
  | 'downgrade'
  | 'duration_change'

interface PreviewSubscribeRequest {
  plan_slug: string
  team_credit_stop_id?: string
  billing_cycle?: SubscribeBillingCycle
}

type SubscribeBillingCycle = 'monthly' | 'yearly'

interface SubscribeRequest {
  plan_slug: string
  idempotency_key?: string
  return_url?: string
  cancel_url?: string
  /** Required for the per-credit Team plan; selects the slider stop. */
  team_credit_stop_id?: string
  billing_cycle?: SubscribeBillingCycle
}

export interface SubscribeOptions {
  returnUrl?: string
  cancelUrl?: string
  teamCreditStopId?: string
  billingCycle?: SubscribeBillingCycle
}

export interface PreviewSubscribeOptions {
  teamCreditStopId?: string
  billingCycle?: SubscribeBillingCycle
}

type SubscribeStatus = 'subscribed' | 'needs_payment_method' | 'pending_payment'

export interface SubscribeResponse {
  billing_op_id: string
  status: SubscribeStatus
  effective_at?: string
  payment_method_url?: string
}

interface CancelSubscriptionRequest {
  idempotency_key?: string
}

interface CancelSubscriptionResponse {
  billing_op_id: string
  cancel_at: string
}

interface ResubscribeRequest {
  idempotency_key?: string
}

interface ResubscribeResponse {
  billing_op_id: string
  status: 'active'
  message?: string
}

interface PaymentPortalRequest {
  return_url?: string
}

interface PaymentPortalResponse {
  url: string
}

interface PreviewPlanInfo {
  slug: string
  tier: SubscriptionTier
  duration: SubscriptionDuration
  price_cents: number
  credits_cents: number
  seat_summary: PlanSeatSummary
  period_start?: string
  period_end?: string
}

export interface PreviewSubscribeResponse {
  allowed: boolean
  reason?: string
  transition_type: SubscriptionTransitionType
  effective_at: string
  is_immediate: boolean
  cost_today_cents: number
  cost_next_period_cents: number
  credits_today_cents: number
  credits_next_period_cents: number
  current_plan?: PreviewPlanInfo
  new_plan: PreviewPlanInfo
}

export type BillingSubscriptionStatus =
  | 'active'
  | 'scheduled'
  | 'ended'
  | 'canceled'

export type BillingStatus =
  | 'awaiting_payment_method'
  | 'pending_payment'
  | 'paid'
  | 'payment_failed'
  // A Stripe-paused subscription stays `active` on the activity axis; the pause
  // is a payment-lifecycle fact. Not emitted until cloud#5075 ships.
  | 'paused'
  | 'inactive'

export interface CurrentTeamCreditStop {
  id: string
  credits_monthly: number
  stop_usd: number
}

export interface BillingStatusResponse {
  is_active: boolean
  billing_rail?: BillingRail
  subscription_status?: BillingSubscriptionStatus
  subscription_tier?: SubscriptionTier
  subscription_duration?: SubscriptionDuration
  plan_slug?: string
  billing_status?: BillingStatus
  has_funds: boolean
  cancel_at?: string
  renewal_date?: string
  team_credit_stop?: CurrentTeamCreditStop
}

export interface BillingBalanceResponse {
  amount_micros: number
  prepaid_balance_micros?: number
  cloud_credit_balance_micros?: number
  pending_charges_micros?: number
  effective_balance_micros?: number
  currency: string
}

interface CreateTopupRequest {
  amount_cents: number
  idempotency_key?: string
}

type TopupStatus = 'pending' | 'completed' | 'failed'

export interface CreateTopupResponse {
  billing_op_id: string
  topup_id: string
  status: TopupStatus
  amount_cents: number
}

interface BillingOpCustomerAction {
  type: 'pay_hosted_invoice'
  url: string
}

interface BillingOpStatusBase {
  id: string
  started_at: string
}

export type BillingOpStatusResponse = BillingOpStatusBase &
  (
    | {
        status: 'pending'
        customer_action?: BillingOpCustomerAction
      }
    | {
        status: 'succeeded' | 'failed'
        error_message?: string
        customer_action?: never
      }
  ) & {
    completed_at?: string
  }

interface BillingEvent {
  event_type: string
  event_id: string
  params?: Record<string, unknown>
  createdAt: string
}

interface BillingEventsResponse {
  total: number
  events: BillingEvent[]
  page: number
  limit: number
  totalPages: number
}

interface GetBillingEventsParams {
  page?: number
  limit?: number
}

class WorkspaceApiError extends Error {
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
    throw new WorkspaceApiError(message, status)
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
  async create(payload: CreateWorkspacePayload): Promise<WorkspaceWithRole> {
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
    payload: UpdateWorkspacePayload
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
      return response.data
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
          billing_cycle: options.billingCycle
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
        { headers }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err)
    }
  }
}
