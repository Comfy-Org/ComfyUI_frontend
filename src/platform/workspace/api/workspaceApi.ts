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
  RenewalInvoice,
  ResubscribeRequest,
  ResubscribeResponse,
  SavedPaymentMethod,
  ScheduledPlanChange,
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

import {
  webSessionRequests,
  webSessionSend
} from '@/platform/auth/session/webSessionFetch'
import { useTelemetry } from '@/platform/telemetry'
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

import { createWebSessionAdapter } from './webSessionAdapter'
import {
  NO_WORKSPACE_ACCESS,
  NoWorkspaceAccessError,
  WorkspaceApiError
} from './workspaceApiError'
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
  /** Set when the caller reported this attempt's `billing.operation.started`; never sent to the server. */
  attemptStartedAt?: number
}

export interface PreviewSubscribeOptions {
  teamCreditStopId?: string
  promotionCode?: string
}

export type { SubscribeResponse }

export type { PreviewSubscribeResponse }

export type BillingSubscriptionStatus = NonNullable<
  BillingStatusResponse['subscription_status']
>

export type { BillingStatus }
export type { BillingStatusResponse }
export type { RenewalInvoice }
export type { ScheduledPlanChange }

export type { BillingBalanceResponse }
export type { BillingEventsResponse }
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
export type BillingOperationPhase = NonNullable<
  BillingOpStatusResponse['phase']
>
export type BillingRecoveryAction = NonNullable<
  BillingOpStatusResponse['recovery_action']
>

/**
 * The developer-platform deployment listing and pick (FE-2434, BE-17480), as
 * ingest's OpenAPI declares them. Declared here until the ingest-types sync
 * generates them from that spec.
 */
export interface WorkspaceDeployment {
  deployment_id: string
  release_id: string
  build_id?: string
  build_name?: string
  release_version?: number
  status: string
  created_at: string
}

export interface WorkspaceDeploymentList {
  items: WorkspaceDeployment[]
  builds_visible: boolean
  picked_deployment_id?: string
  pick_source?: 'browser' | 'workspace_default'
  default_deployment_id?: string
  gone_picked_deployment_id?: string
  gone_default_deployment_id?: string
}

interface PickWorkspaceDeploymentRequest {
  deployment_id: string
}

interface GetBillingEventsParams {
  page?: number
  limit?: number
}

export { WorkspaceApiError }

const workspaceApiClient = axios.create({
  headers: {
    'Content-Type': 'application/json'
  }
})

// acceptInvite opts out via __skipUnifiedRemint (it is deliberately Firebase-authed).
attachUnifiedRemintInterceptor(workspaceApiClient)
attachCapabilityRevisionInterceptor(workspaceApiClient)

async function requestAuth() {
  if (webSessionRequests()) {
    const send = await webSessionSend()
    if (send) return { adapter: createWebSessionAdapter(send) }
  }
  return { headers: await useAuthStore().getWorkspaceAuthHeaderOrThrow() }
}

type WorkspaceApiOperation = keyof typeof workspaceApi

function handleAxiosError(
  err: unknown,
  operation: WorkspaceApiOperation
): never {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status
    const { code, message } = errorResponseFromBody(
      err.response?.data,
      err.message
    )
    if (status === 403 && code === NO_WORKSPACE_ACCESS) {
      throw new NoWorkspaceAccessError(message, status, operation)
    }
    // Callers compare `code` against server-defined values, so the parser's
    // "no code reported" sentinel must stay out of that contract.
    throw new WorkspaceApiError(
      message,
      status,
      code === UNKNOWN_ERROR_CODE ? undefined : code,
      undefined,
      operation
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
    const auth = await requestAuth()
    try {
      const response = await workspaceApiClient.get<ListWorkspacesResponse>(
        workspaceApiUrl('/workspaces'),
        auth
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'list')
    }
  },

  /**
   * Get the workspace bound to the current credential
   * GET /api/workspaces/current
   */
  async getCurrentWorkspace(): Promise<CurrentWorkspaceResponse> {
    const auth = await requestAuth()
    try {
      const response = await workspaceApiClient.get<CurrentWorkspaceResponse>(
        workspaceApiUrl('/workspaces/current'),
        auth
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'getCurrentWorkspace')
    }
  },

  /**
   * Create a new workspace
   * POST /api/workspaces
   */
  async create(payload: CreateWorkspaceRequest): Promise<WorkspaceWithRole> {
    const auth = await requestAuth()
    try {
      const response = await workspaceApiClient.post<WorkspaceWithRole>(
        workspaceApiUrl('/workspaces'),
        payload,
        auth
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'create')
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
    const auth = await requestAuth()
    try {
      const response = await workspaceApiClient.patch<WorkspaceWithRole>(
        workspaceApiUrl(`/workspaces/${workspaceId}`),
        payload,
        auth
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'update')
    }
  },

  /**
   * List the developer-platform deployments this browser may pick, each
   * with the Release it runs now, and which one it picked. 403 when the account is outside the rollout.
   * Times out after 30 seconds: ingest answers it with several upstream calls
   * in a row (deployments, builds, then each Build's Releases), and the
   * editor's missing-model check waits for it, so it must always settle.
   * GET /api/workspaces/:id/deployments
   */
  async listDeployments(
    workspaceId: WorkspaceId
  ): Promise<WorkspaceDeploymentList> {
    const auth = await requestAuth()
    try {
      const response = await workspaceApiClient.get<WorkspaceDeploymentList>(
        workspaceApiUrl(`/workspaces/${workspaceId}/deployments`),
        { ...auth, timeout: 30_000 }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'listDeployments')
    }
  },

  /**
   * Pick the deployment this browser runs on; it follows the deployment's
   * updates to new Releases. The pick is a cookie on the
   * response; nothing about the workspace changes.
   * PUT /api/workspaces/:id/deployment
   */
  async pickDeployment(
    workspaceId: WorkspaceId,
    payload: PickWorkspaceDeploymentRequest
  ): Promise<void> {
    const auth = await requestAuth()
    try {
      await workspaceApiClient.put(
        workspaceApiUrl(`/workspaces/${workspaceId}/deployment`),
        payload,
        auth
      )
    } catch (err) {
      handleAxiosError(err, 'pickDeployment')
    }
  },

  /**
   * Clear the pick: this browser runs on Comfy Cloud, or with
   * `follow: 'workspace'` on whatever the workspace says (its default
   * deployment, or Comfy Cloud when it has none).
   * DELETE /api/workspaces/:id/deployment
   */
  async clearDeployment(
    workspaceId: WorkspaceId,
    options: { follow?: 'workspace' } = {}
  ): Promise<void> {
    const auth = await requestAuth()
    try {
      await workspaceApiClient.delete(
        workspaceApiUrl(`/workspaces/${workspaceId}/deployment`),
        {
          ...auth,
          params: options.follow ? { follow: options.follow } : undefined
        }
      )
    } catch (err) {
      handleAxiosError(err, 'clearDeployment')
    }
  },

  /**
   * Set the deployment members of the workspace run on when their browser has
   * no pick of its own (BE-17480). Owner only.
   * PUT /api/workspaces/:id/default-deployment
   */
  async setDefaultDeployment(
    workspaceId: WorkspaceId,
    payload: PickWorkspaceDeploymentRequest
  ): Promise<void> {
    const auth = await requestAuth()
    try {
      await workspaceApiClient.put(
        workspaceApiUrl(`/workspaces/${workspaceId}/default-deployment`),
        payload,
        auth
      )
    } catch (err) {
      handleAxiosError(err, 'setDefaultDeployment')
    }
  },

  /**
   * Clear the workspace's default deployment; members with no pick are back on
   * Comfy Cloud. Owner only.
   * DELETE /api/workspaces/:id/default-deployment
   */
  async clearDefaultDeployment(workspaceId: WorkspaceId): Promise<void> {
    const auth = await requestAuth()
    try {
      await workspaceApiClient.delete(
        workspaceApiUrl(`/workspaces/${workspaceId}/default-deployment`),
        auth
      )
    } catch (err) {
      handleAxiosError(err, 'clearDefaultDeployment')
    }
  },

  /**
   * Delete a workspace (owner only)
   * DELETE /api/workspaces/:id
   */
  async delete(workspaceId: WorkspaceId): Promise<void> {
    const auth = await requestAuth()
    try {
      await workspaceApiClient.delete(
        workspaceApiUrl(`/workspaces/${workspaceId}`),
        auth
      )
    } catch (err) {
      handleAxiosError(err, 'delete')
    }
  },

  /**
   * Leave the current workspace.
   * POST /api/workspace/leave
   */
  async leave(): Promise<void> {
    const auth = await requestAuth()
    try {
      await workspaceApiClient.post(
        workspaceApiUrl('/workspace/leave'),
        null,
        auth
      )
    } catch (err) {
      handleAxiosError(err, 'leave')
    }
  },

  /**
   * List workspace members (paginated).
   * GET /api/workspace/members
   */
  async listMembers(params?: ListMembersParams): Promise<ListMembersResponse> {
    const auth = await requestAuth()
    try {
      const response = await workspaceApiClient.get<ListMembersResponse>(
        workspaceApiUrl('/workspace/members'),
        { ...auth, params }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'listMembers')
    }
  },

  /**
   * Remove a member from the workspace.
   * DELETE /api/workspace/members/:userId
   */
  async removeMember(userId: UserId): Promise<void> {
    const auth = await requestAuth()
    try {
      await workspaceApiClient.delete(
        workspaceApiUrl(`/workspace/members/${userId}`),
        auth
      )
    } catch (err) {
      handleAxiosError(err, 'removeMember')
    }
  },

  /**
   * Change a member's role (member ↔ owner).
   * PATCH /api/workspace/members/:userId
   */
  async updateMemberRole(userId: UserId, role: WorkspaceRole): Promise<Member> {
    const auth = await requestAuth()
    try {
      const response = await workspaceApiClient.patch<Member>(
        workspaceApiUrl(`/workspace/members/${userId}`),
        { role },
        auth
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'updateMemberRole')
    }
  },

  /**
   * List pending invites for the workspace.
   * GET /api/workspace/invites
   */
  async listInvites(): Promise<ListInvitesResponse> {
    const auth = await requestAuth()
    try {
      const response = await workspaceApiClient.get<ListInvitesResponse>(
        workspaceApiUrl('/workspace/invites'),
        auth
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'listInvites')
    }
  },

  /**
   * Create an invite for the workspace.
   * POST /api/workspace/invites
   */
  async createInvite(payload: CreateInviteRequest): Promise<PendingInvite> {
    const auth = await requestAuth()
    try {
      const response = await workspaceApiClient.post<PendingInvite>(
        workspaceApiUrl('/workspace/invites'),
        payload,
        auth
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'createInvite')
    }
  },

  /**
   * Revoke a pending invite.
   * DELETE /api/workspace/invites/:inviteId
   */
  async revokeInvite(inviteId: WorkspaceInviteId): Promise<void> {
    const auth = await requestAuth()
    try {
      await workspaceApiClient.delete(
        workspaceApiUrl(`/workspace/invites/${inviteId}`),
        auth
      )
    } catch (err) {
      handleAxiosError(err, 'revokeInvite')
    }
  },

  async resendInvite(inviteId: WorkspaceInviteId): Promise<PendingInvite> {
    const auth = await requestAuth()
    try {
      const response = await workspaceApiClient.post<PendingInvite>(
        workspaceApiUrl(
          `/workspace/invites/${encodeURIComponent(inviteId)}/resend`
        ),
        null,
        auth
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'resendInvite')
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
      handleAxiosError(err, 'acceptInvite')
    }
  },

  /**
   * Get billing status for the current workspace
   * GET /api/billing/status
   */
  async getBillingStatus(): Promise<BillingStatusResponse> {
    const auth = await requestAuth()
    try {
      const response = await workspaceApiClient.get<BillingStatusResponse>(
        workspaceApiUrl('/billing/status'),
        auth
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'getBillingStatus')
    }
  },

  /**
   * Get credit balance for the current workspace
   * GET /api/billing/balance
   */
  async getBillingBalance(): Promise<BillingBalanceResponse> {
    const auth = await requestAuth()
    try {
      const response = await workspaceApiClient.get<BillingBalanceResponse>(
        workspaceApiUrl('/billing/balance'),
        auth
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'getBillingBalance')
    }
  },

  /**
   * Get billing capabilities for the current workspace
   * GET /api/billing/capabilities
   */
  async getBillingCapabilities(
    signal?: AbortSignal
  ): Promise<BillingCapabilitiesResponse> {
    const auth = await requestAuth()
    try {
      const response =
        await workspaceApiClient.get<BillingCapabilitiesResponse>(
          workspaceApiUrl('/billing/capabilities'),
          { ...auth, timeout: 10_000, signal }
        )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'getBillingCapabilities')
    }
  },

  /**
   * Get available subscription plans
   * GET /api/billing/plans
   */
  async getBillingPlans(): Promise<BillingPlansResponse> {
    const auth = await requestAuth()
    try {
      const response = await workspaceApiClient.get<BillingPlansResponse>(
        workspaceApiUrl('/billing/plans'),
        auth
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'getBillingPlans')
    }
  },

  async listSavedPaymentMethods(): Promise<SavedPaymentMethod[]> {
    const auth = await requestAuth()
    try {
      const response = await workspaceApiClient.get<SavedPaymentMethod[]>(
        workspaceApiUrl('/billing/payment-methods'),
        auth
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'listSavedPaymentMethods')
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
    const auth = await requestAuth()
    try {
      const response = await workspaceApiClient.post<PreviewSubscribeResponse>(
        workspaceApiUrl('/billing/preview-subscribe'),
        {
          plan_slug: planSlug,
          team_credit_stop_id: options.teamCreditStopId,
          promotion_code: options.promotionCode
        } satisfies PreviewSubscribeRequest,
        auth
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'previewSubscribe')
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
    const auth = await requestAuth()
    try {
      useTelemetry()?.trackBillingEvent({
        operation: 'subscription_checkout',
        stage: 'request_sent',
        outcome: 'pending'
      })
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
          proration_at: options.prorationAt
        } satisfies SubscribeRequest,
        auth
      )
      useTelemetry()?.trackBillingEvent({
        operation: 'subscription_checkout',
        stage: 'checkout_received',
        outcome: 'pending',
        billing_op_id: response.data.billing_op_id,
        checkout_status: response.data.status
      })
      return response.data
    } catch (err) {
      handleAxiosError(err, 'subscribe')
    }
  },

  /**
   * Cancel current subscription
   * POST /api/billing/subscription/cancel
   */
  async cancelSubscription(
    idempotencyKey?: string
  ): Promise<CancelSubscriptionResponse> {
    const auth = await requestAuth()
    try {
      const response =
        await workspaceApiClient.post<CancelSubscriptionResponse>(
          workspaceApiUrl('/billing/subscription/cancel'),
          {
            idempotency_key: idempotencyKey
          } satisfies CancelSubscriptionRequest,
          auth
        )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'cancelSubscription')
    }
  },

  async getChurnkeyAuth(): Promise<ChurnkeyAuthResponse> {
    const auth = await requestAuth()
    try {
      const response = await workspaceApiClient.get<unknown>(
        workspaceApiUrl('/billing/churnkey/auth'),
        auth
      )
      return churnkeyAuthResponseSchema.parse(response.data)
    } catch (err) {
      handleAxiosError(err, 'getChurnkeyAuth')
    }
  },

  /**
   * Resubscribe (undo cancel) before period ends
   * POST /api/billing/subscription/resubscribe
   */
  async resubscribe(idempotencyKey?: string): Promise<ResubscribeResponse> {
    const auth = await requestAuth()
    try {
      const response = await workspaceApiClient.post<ResubscribeResponse>(
        workspaceApiUrl('/billing/subscription/resubscribe'),
        { idempotency_key: idempotencyKey } satisfies ResubscribeRequest,
        auth
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'resubscribe')
    }
  },

  /**
   * Get Stripe payment portal URL for managing payment methods
   * POST /api/billing/payment-portal
   */
  async getPaymentPortalUrl(
    returnUrl?: string
  ): Promise<PaymentPortalResponse> {
    const auth = await requestAuth()
    try {
      const response = await workspaceApiClient.post<PaymentPortalResponse>(
        workspaceApiUrl('/billing/payment-portal'),
        { return_url: returnUrl } satisfies PaymentPortalRequest,
        auth
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'getPaymentPortalUrl')
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
    const auth = await requestAuth()
    try {
      useTelemetry()?.trackBillingEvent({
        operation: 'topup',
        stage: 'request_sent',
        outcome: 'pending'
      })
      const response = await workspaceApiClient.post<CreateTopupResponse>(
        workspaceApiUrl('/billing/topup'),
        {
          amount_cents: amountCents,
          idempotency_key: idempotencyKey
        } satisfies CreateTopupRequest,
        auth
      )
      useTelemetry()?.trackBillingEvent({
        operation: 'topup',
        stage: 'checkout_received',
        outcome: 'pending',
        billing_op_id: response.data.billing_op_id,
        checkout_status: response.data.status
      })
      return response.data
    } catch (err) {
      handleAxiosError(err, 'createTopup')
    }
  },

  /**
   * Get billing events
   * GET /api/billing/events
   */
  async getBillingEvents(
    params?: GetBillingEventsParams
  ): Promise<BillingEventsResponse> {
    const auth = await requestAuth()
    try {
      const response = await workspaceApiClient.get<BillingEventsResponse>(
        workspaceApiUrl('/billing/events'),
        { ...auth, params }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'getBillingEvents')
    }
  },

  /**
   * Get billing operation status
   * GET /api/billing/ops/:id
   */
  async getBillingOpStatus(opId: string): Promise<BillingOpStatusResponse> {
    const auth = await requestAuth()
    try {
      const response = await workspaceApiClient.get<BillingOpStatusResponse>(
        workspaceApiUrl(`/billing/ops/${encodeURIComponent(opId)}`),
        { ...auth, timeout: 30_000 }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'getBillingOpStatus')
    }
  }
}
