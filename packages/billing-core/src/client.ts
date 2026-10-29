import type {
  AutoReloadSettings,
  BillingBalanceResponse,
  BillingCapabilitiesResponse,
  BillingEventsResponse,
  BillingOpStatusResponse,
  BillingPlansResponse,
  BillingStatus,
  BillingStatusResponse as GeneratedBillingStatusResponse,
  CancelSubscriptionRequest,
  CancelSubscriptionResponse,
  CreateTopupCheckoutRequest,
  CreateTopupCheckoutResponse,
  CreateTopupRequest,
  CreateTopupResponse,
  HostedTopupCheckout,
  HostedTopupCheckoutList,
  PaymentPortalRequest,
  PaymentPortalResponse,
  Plan,
  PreviewSubscribeRequest,
  PreviewSubscribeResponse,
  RenewalInvoice,
  ResubscribeRequest,
  ResubscribeResponse,
  RetentionAcceptance,
  RetentionAcceptRequest,
  RetentionFlowEventRequest,
  RetentionFlowResponse,
  RevertScheduledChangeRequest,
  RevertScheduledChangeResponse,
  SavedPaymentMethod,
  ScheduledPlanChange,
  SubscribeRequest,
  SubscribeResponse,
  SubscriptionDuration,
  SubscriptionTier,
  TeamCreditStops,
  TeamCreditStopSummary
} from '@comfyorg/ingest-types'
import {
  zRetentionAcceptance,
  zRetentionFlowResponse
} from '@comfyorg/ingest-types/zod'
import type { BillingTelemetryEvent } from '@comfyorg/account-core/billing'
import type { AxiosInstance, AxiosRequestConfig } from 'axios'

export type BillingRail = NonNullable<BillingStatusResponse['billing_rail']>
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
  attemptStartedAt?: number
}

export interface PreviewSubscribeOptions {
  teamCreditStopId?: string
  promotionCode?: string
}

function assertExclusivePaymentCredentials(options: SubscribeOptions): void {
  if (options.confirmationToken && options.savedPaymentMethodId) {
    throw new TypeError(
      'confirmationToken and savedPaymentMethodId are mutually exclusive'
    )
  }
}

export type { SubscribeResponse }

export type { PreviewSubscribeResponse }

export type BillingSubscriptionStatus = NonNullable<
  BillingStatusResponse['subscription_status']
>

export type { BillingStatus }
export type BillingStatusResponse = Omit<
  GeneratedBillingStatusResponse,
  'ended_at'
> &
  Partial<Pick<GeneratedBillingStatusResponse, 'ended_at'>>
export type { RenewalInvoice }
export type { ScheduledPlanChange }

export type { AutoReloadSettings }
export type { BillingBalanceResponse }
export type { BillingEventsResponse }
export type { BillingCapabilitiesResponse }
export type BillingCapabilitiesRead = Omit<
  BillingCapabilitiesResponse,
  'denied_reasons' | 'auto_top_up_enabled'
> &
  Partial<Pick<BillingCapabilitiesResponse, 'auto_top_up_enabled'>> & {
    denied_reasons?: Readonly<Partial<Record<string, string>>>
  }
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

interface GetBillingEventsParams {
  page?: number
  limit?: number
}

export type { SubscriptionTier }
export type { SubscriptionDuration }
export type { Plan }
export type { BillingPlansResponse }
export type { TeamCreditStops }
export type { TeamCreditStopSummary }

export interface BillingApiOptions {
  client: AxiosInstance
  requestAuth: () => Promise<AxiosRequestConfig>
  resolveUrl: (route: string) => string
  handleError: (error: unknown, operation: string) => never
  trackBillingEvent: (event: BillingTelemetryEvent) => void
}

export function createBillingApi({
  client,
  requestAuth,
  resolveUrl,
  handleError,
  trackBillingEvent
}: BillingApiOptions) {
  function handleAxiosError(error: unknown, operation: string): never {
    return handleError(error, operation)
  }
  return {
    async getBillingStatus(): Promise<BillingStatusResponse> {
      const auth = await requestAuth()
      try {
        const response = await client.get<BillingStatusResponse>(
          resolveUrl('/billing/status'),
          auth
        )
        return response.data
      } catch (err) {
        handleAxiosError(err, 'getBillingStatus')
      }
    },
    async getBillingBalance(): Promise<BillingBalanceResponse> {
      const auth = await requestAuth()
      try {
        const response = await client.get<BillingBalanceResponse>(
          resolveUrl('/billing/balance'),
          auth
        )
        return response.data
      } catch (err) {
        handleAxiosError(err, 'getBillingBalance')
      }
    },
    async getBillingCapabilities(
      signal?: AbortSignal
    ): Promise<BillingCapabilitiesResponse> {
      const auth = await requestAuth()
      try {
        const response = await client.get<BillingCapabilitiesResponse>(
          resolveUrl('/billing/capabilities'),
          { ...auth, timeout: 10_000, signal }
        )
        return response.data
      } catch (err) {
        handleAxiosError(err, 'getBillingCapabilities')
      }
    },
    async getBillingAutoReload(): Promise<AutoReloadSettings> {
      const auth = await requestAuth()
      try {
        const response = await client.get<AutoReloadSettings>(
          resolveUrl('/billing/auto-reload'),
          { ...auth, timeout: 10_000 }
        )
        return response.data
      } catch (err) {
        handleAxiosError(err, 'getBillingAutoReload')
      }
    },
    async getBillingPlans(): Promise<BillingPlansResponse> {
      const auth = await requestAuth()
      try {
        const response = await client.get<BillingPlansResponse>(
          resolveUrl('/billing/plans'),
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
        const response = await client.get<SavedPaymentMethod[]>(
          resolveUrl('/billing/payment-methods'),
          auth
        )
        return response.data
      } catch (err) {
        handleAxiosError(err, 'listSavedPaymentMethods')
      }
    },
    async previewSubscribe(
      planSlug: string,
      options: PreviewSubscribeOptions = {}
    ): Promise<PreviewSubscribeResponse> {
      const auth = await requestAuth()
      try {
        const response = await client.post<PreviewSubscribeResponse>(
          resolveUrl('/billing/preview-subscribe'),
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
    async subscribe(
      planSlug: string,
      options: SubscribeOptions = {}
    ): Promise<SubscribeResponse> {
      assertExclusivePaymentCredentials(options)
      const auth = await requestAuth()
      try {
        trackBillingEvent({
          operation: 'subscription_checkout',
          stage: 'request_sent',
          outcome: 'pending'
        })
        const response = await client.post<SubscribeResponse>(
          resolveUrl('/billing/subscribe'),
          {
            plan_slug: planSlug,
            confirmation_token: options.confirmationToken || undefined,
            saved_payment_method_id: options.savedPaymentMethodId || undefined,
            promotion_code: options.promotionCode,
            quote_id: options.quoteId,
            quote_version: options.quoteVersion,
            return_url: options.returnUrl,
            cancel_url: options.cancelUrl,
            team_credit_stop_id: options.teamCreditStopId,
            billing_cycle: options.billingCycle,
            confirm_reactivation: options.confirmReactivation,
            proration_at: options.prorationAt
          } satisfies SubscribeRequest,
          auth
        )
        trackBillingEvent({
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
    async cancelSubscription(
      idempotencyKey?: string
    ): Promise<CancelSubscriptionResponse> {
      const auth = await requestAuth()
      try {
        const response = await client.post<CancelSubscriptionResponse>(
          resolveUrl('/billing/subscription/cancel'),
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
    async prepareRetentionFlow(): Promise<RetentionFlowResponse> {
      const auth = await requestAuth()
      try {
        const response = await client.post<unknown>(
          resolveUrl('/billing/retention/prepare'),
          {},
          { ...auth, timeout: 5_000 }
        )
        return zRetentionFlowResponse.parse(response.data)
      } catch (err) {
        handleAxiosError(err, 'prepareRetentionFlow')
      }
    },
    async acceptRetentionOffer(
      sessionId: string
    ): Promise<RetentionAcceptance> {
      const auth = await requestAuth()
      try {
        const response = await client.post<unknown>(
          resolveUrl('/billing/retention/accept'),
          { session_id: sessionId } satisfies RetentionAcceptRequest,
          auth
        )
        return zRetentionAcceptance.parse(response.data)
      } catch (err) {
        handleAxiosError(err, 'acceptRetentionOffer')
      }
    },
    async recordRetentionFlowEvent(
      request: RetentionFlowEventRequest
    ): Promise<void> {
      const auth = await requestAuth()
      try {
        await client.post(
          resolveUrl('/billing/retention/events'),
          request,
          auth
        )
      } catch (err) {
        handleAxiosError(err, 'recordRetentionFlowEvent')
      }
    },
    async resubscribe(idempotencyKey?: string): Promise<ResubscribeResponse> {
      const auth = await requestAuth()
      try {
        const response = await client.post<ResubscribeResponse>(
          resolveUrl('/billing/subscription/resubscribe'),
          { idempotency_key: idempotencyKey } satisfies ResubscribeRequest,
          auth
        )
        return response.data
      } catch (err) {
        handleAxiosError(err, 'resubscribe')
      }
    },
    async revertScheduledChange(
      idempotencyKey?: string
    ): Promise<RevertScheduledChangeResponse> {
      const auth = await requestAuth()
      try {
        const response = await client.post<RevertScheduledChangeResponse>(
          resolveUrl('/billing/subscription/revert-scheduled-change'),
          {
            idempotency_key: idempotencyKey
          } satisfies RevertScheduledChangeRequest,
          auth
        )
        return response.data
      } catch (err) {
        handleAxiosError(err, 'revertScheduledChange')
      }
    },
    async getPaymentPortalUrl(
      returnUrl?: string,
      flowType?: PaymentPortalRequest['flow_type']
    ): Promise<PaymentPortalResponse> {
      const auth = await requestAuth()
      try {
        const response = await client.post<PaymentPortalResponse>(
          resolveUrl('/billing/payment-portal'),
          {
            return_url: returnUrl,
            flow_type: flowType
          } satisfies PaymentPortalRequest,
          { ...auth, timeout: 30_000 }
        )
        return response.data
      } catch (err) {
        handleAxiosError(err, 'getPaymentPortalUrl')
      }
    },
    async createTopup(
      amountCents: number,
      idempotencyKey?: string
    ): Promise<CreateTopupResponse> {
      const auth = await requestAuth()
      try {
        trackBillingEvent({
          operation: 'topup',
          stage: 'request_sent',
          outcome: 'pending'
        })
        const response = await client.post<CreateTopupResponse>(
          resolveUrl('/billing/topup'),
          {
            amount_cents: amountCents,
            idempotency_key: idempotencyKey
          } satisfies CreateTopupRequest,
          auth
        )
        trackBillingEvent({
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
    async createTopupCheckout(
      amountCents: number,
      returnUrl: string,
      signal?: AbortSignal
    ): Promise<CreateTopupCheckoutResponse> {
      const auth = await requestAuth()
      signal?.throwIfAborted()
      try {
        const response = await client.post<CreateTopupCheckoutResponse>(
          resolveUrl('/billing/topup/checkout'),
          {
            amount_cents: amountCents,
            return_url: returnUrl,
            idempotency_key: crypto.randomUUID()
          } satisfies CreateTopupCheckoutRequest,
          { ...auth, signal }
        )
        return response.data
      } catch (err) {
        handleAxiosError(err, 'createTopupCheckout')
      }
    },
    async listTopupCheckouts(): Promise<HostedTopupCheckoutList> {
      const auth = await requestAuth()
      try {
        const response = await client.get<HostedTopupCheckoutList>(
          resolveUrl('/billing/topup/checkouts'),
          { ...auth, timeout: 10_000 }
        )
        return response.data
      } catch (err) {
        handleAxiosError(err, 'listTopupCheckouts')
      }
    },
    async getTopupCheckout(sessionId: string): Promise<HostedTopupCheckout> {
      const auth = await requestAuth()
      try {
        const response = await client.get<HostedTopupCheckout>(
          resolveUrl(
            `/billing/topup/checkouts/${encodeURIComponent(sessionId)}`
          ),
          { ...auth, timeout: 10_000 }
        )
        return response.data
      } catch (err) {
        handleAxiosError(err, 'getTopupCheckout')
      }
    },
    async getBillingEvents(
      params?: GetBillingEventsParams
    ): Promise<BillingEventsResponse> {
      const auth = await requestAuth()
      try {
        const response = await client.get<BillingEventsResponse>(
          resolveUrl('/billing/events'),
          { ...auth, params }
        )
        return response.data
      } catch (err) {
        handleAxiosError(err, 'getBillingEvents')
      }
    },
    async getBillingOpStatus(opId: string): Promise<BillingOpStatusResponse> {
      const auth = await requestAuth()
      try {
        const response = await client.get<BillingOpStatusResponse>(
          resolveUrl(`/billing/ops/${encodeURIComponent(opId)}`),
          { ...auth, timeout: 30_000 }
        )
        return response.data
      } catch (err) {
        handleAxiosError(err, 'getBillingOpStatus')
      }
    }
  }
}

export type BillingApi = ReturnType<typeof createBillingApi>
export type BillingApiOperation = keyof BillingApi
