import type {
  AcceptInviteResponse,
  BillingBalanceResponse,
  BillingCapabilitiesResponse,
  BillingEventsResponse,
  BillingOpStatusResponse,
  BillingPlansResponse,
  BillingStatus,
  BillingStatusResponse,
  CancelSubscriptionRequest,
  CancelSubscriptionResponse,
  ChurnkeyAuthResponse,
  CreateInviteRequest,
  CreateTopupRequest,
  CreateTopupResponse,
  CreateWorkspaceRequest,
  CurrentWorkspaceResponse,
  ListInvitesResponse,
  ListMembersResponse,
  ListWorkspacesResponse,
  Member as GeneratedMember,
  PaymentPortalRequest,
  PaymentPortalResponse,
  PendingInvite,
  Plan,
  PreviewSubscribeRequest,
  PreviewSubscribeResponse,
  ResubscribeRequest,
  ResubscribeResponse,
  SavedPaymentMethod,
  SubscribeRequest,
  SubscribeResponse,
  SubscriptionDuration,
  SubscriptionTier,
  TeamCreditStops,
  TeamCreditStopSummary,
  UpdateWorkspaceRequest,
  WorkspaceWithRole
} from '@comfyorg/ingest-types'
import axios from 'axios'

import { attachUnifiedRemintInterceptor } from '@/platform/auth/unified/remintRetry'
import { churnkeyAuthResponseSchema } from '@/platform/cloud/churnkey/churnkeyAuthSchema'
import {
  UNKNOWN_ERROR_CODE,
  errorResponseFromBody
} from '@/platform/remote/comfyui/errors'
import { attachCapabilityRevisionInterceptor } from '@/platform/workspace/api/capabilityRevision'
import type {
  WorkspaceId,
  WorkspaceInviteId
} from '@/platform/workspace/workspaceTypes'
import { useAuthStore } from '@/stores/authStore'
import type { UserId } from '@/types/authTypes'

import { workspaceApiUrl } from './workspaceApiUrl'

export type WorkspaceType = 'personal' | 'team'
export type WorkspaceRole = 'owner' | 'member'
export type BillingRail = NonNullable<BillingStatusResponse['billing_rail']>

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
export type { WorkspaceWithRole }
export type { ListWorkspacesResponse }
export type { CurrentWorkspaceResponse }
export type { Plan }
export type { BillingPlansResponse }
export type { TeamCreditStops }
export type { TeamCreditStopSummary }

type SubscribeBillingCycle = 'monthly' | 'yearly'

export interface SubscribeOptions {
  confirmationToken?: string
  promotionCode?: string
  quoteId?: string
  quoteVersion?: number
  savedPaymentMethodId?: string
  returnUrl?: string
  cancelUrl?: string
  teamCreditStopId?: string
  billingCycle?: SubscribeBillingCycle
  confirmReactivation?: boolean
  prorationAt?: string
  checkoutAttemptId?: string
}

export interface PreviewSubscribeOptions {
  teamCreditStopId?: string
  promotionCode?: string
  checkoutAttemptId?: string
}

/**
 * `checkout_attempt_id` is the client-minted key that joins an abandoned
 * attempt's frontend events to its billing op. It is not yet in the generated
 * request schemas; drop these once `@comfyorg/ingest-types` ships it.
 */
type WithCheckoutAttemptId<T> = T & { checkout_attempt_id?: string }

export type { SubscribeResponse }

export type { PreviewSubscribeResponse }

export type BillingSubscriptionStatus = NonNullable<
  BillingStatusResponse['subscription_status']
>

export type { BillingStatus }
export type { BillingStatusResponse }

export type { BillingBalanceResponse }
export type { BillingCapabilitiesResponse }
export type { CreateTopupResponse }
export type { BillingOpStatusResponse }
export type { SavedPaymentMethod }
export type BillingAuthenticationState = NonNullable<
  BillingOpStatusResponse['authentication_state']
>
export type BillingDeclineReason = NonNullable<
  BillingOpStatusResponse['decline_reason']
>

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
attachCapabilityRevisionInterceptor(workspaceApiClient)

async function getAuthHeaderOrThrow() {
  return useAuthStore().getWorkspaceAuthHeaderOrThrow()
}

function handleAxiosError(err: unknown): never {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status
    const { code, message } = errorResponseFromBody(
      err.response?.data,
      err.message
    )
    // Callers compare `code` against server-defined values, so the parser's
    // "no code reported" sentinel must stay out of that contract.
    throw new WorkspaceApiError(
      message,
      status,
      code === UNKNOWN_ERROR_CODE ? undefined : code
    )
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
        workspaceApiUrl('/workspaces'),
        { headers }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err)
    }
  },

  /**
   * Get the workspace bound to the current credential
   * GET /api/workspaces/current
   */
  async getCurrentWorkspace(): Promise<CurrentWorkspaceResponse> {
    const headers = await getAuthHeaderOrThrow()
    try {
      const response = await workspaceApiClient.get<CurrentWorkspaceResponse>(
        workspaceApiUrl('/workspaces/current'),
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
        workspaceApiUrl('/workspaces'),
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
        workspaceApiUrl(`/workspaces/${workspaceId}`),
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
        workspaceApiUrl(`/workspaces/${workspaceId}`),
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
      await workspaceApiClient.post(workspaceApiUrl('/workspace/leave'), null, {
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
        workspaceApiUrl('/workspace/members'),
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
        workspaceApiUrl(`/workspace/members/${userId}`),
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
        workspaceApiUrl(`/workspace/members/${userId}`),
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
        workspaceApiUrl('/workspace/invites'),
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
        workspaceApiUrl('/workspace/invites'),
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
        workspaceApiUrl(`/workspace/invites/${inviteId}`),
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
        workspaceApiUrl(
          `/workspace/invites/${encodeURIComponent(inviteId)}/resend`
        ),
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
        workspaceApiUrl(`/invites/${token}/accept`),
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
        workspaceApiUrl('/billing/status'),
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
        workspaceApiUrl('/billing/balance'),
        { headers }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err)
    }
  },

  /**
   * Get billing capabilities for the current workspace
   * GET /api/billing/capabilities
   */
  async getBillingCapabilities(
    signal?: AbortSignal
  ): Promise<BillingCapabilitiesResponse> {
    const headers = await getAuthHeaderOrThrow()
    try {
      const response =
        await workspaceApiClient.get<BillingCapabilitiesResponse>(
          workspaceApiUrl('/billing/capabilities'),
          { headers, timeout: 10_000, signal }
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
        workspaceApiUrl('/billing/plans'),
        { headers }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err)
    }
  },

  async listSavedPaymentMethods(): Promise<SavedPaymentMethod[]> {
    const headers = await getAuthHeaderOrThrow()
    try {
      const response = await workspaceApiClient.get<SavedPaymentMethod[]>(
        workspaceApiUrl('/billing/payment-methods'),
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
        workspaceApiUrl('/billing/preview-subscribe'),
        {
          plan_slug: planSlug,
          team_credit_stop_id: options.teamCreditStopId,
          promotion_code: options.promotionCode,
          checkout_attempt_id: options.checkoutAttemptId
        } satisfies WithCheckoutAttemptId<PreviewSubscribeRequest>,
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
    if (
      options.confirmationToken !== undefined &&
      options.savedPaymentMethodId !== undefined
    ) {
      throw new TypeError(
        'confirmationToken and savedPaymentMethodId are mutually exclusive'
      )
    }
    // JSON drops `undefined` but keeps `''`, so an empty credential would reach
    // the API as a present-but-meaningless value.
    const confirmationToken = options.confirmationToken || undefined
    const savedPaymentMethodId = options.savedPaymentMethodId || undefined
    const headers = await getAuthHeaderOrThrow()
    try {
      const response = await workspaceApiClient.post<SubscribeResponse>(
        workspaceApiUrl('/billing/subscribe'),
        {
          plan_slug: planSlug,
          confirmation_token: confirmationToken,
          promotion_code: options.promotionCode,
          quote_id: options.quoteId,
          quote_version: options.quoteVersion,
          saved_payment_method_id: savedPaymentMethodId,
          return_url: options.returnUrl,
          cancel_url: options.cancelUrl,
          team_credit_stop_id: options.teamCreditStopId,
          billing_cycle: options.billingCycle,
          confirm_reactivation: options.confirmReactivation,
          proration_at: options.prorationAt,
          checkout_attempt_id: options.checkoutAttemptId
        } satisfies WithCheckoutAttemptId<SubscribeRequest>,
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
          workspaceApiUrl('/billing/subscription/cancel'),
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
        workspaceApiUrl('/billing/churnkey/auth'),
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
        workspaceApiUrl('/billing/subscription/resubscribe'),
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
        workspaceApiUrl('/billing/payment-portal'),
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
        workspaceApiUrl('/billing/topup'),
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
        workspaceApiUrl('/billing/events'),
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
        workspaceApiUrl(`/billing/ops/${encodeURIComponent(opId)}`),
        { headers, timeout: 30_000 }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err)
    }
  }
}
