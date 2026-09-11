import type {
  ChurnkeyAuthResponse,
  ChurnkeyFlowResponse
} from '@comfyorg/ingest-types'
import { createScriptLoader } from '@comfyorg/shared-frontend-utils/loadExternalScript'

import { z } from 'zod'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { t } from '@/i18n'
import { reportError } from '@/platform/telemetry/reportError'
import {
  workspaceApi,
  WorkspaceApiError
} from '@/platform/workspace/api/workspaceApi'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'
import { toError } from '@/utils/errorUtil'

import type {
  ChurnkeyHandlerResult,
  ChurnkeyInit,
  ChurnkeyInitConfig,
  ChurnkeySessionResults
} from './types'

const EMBED_SCRIPT_URL = 'https://assets.churnkey.co/js/app.js'

const scriptLoaders = new Map<string, () => Promise<ChurnkeyInit>>()

function loadChurnkey(appId: string): Promise<ChurnkeyInit> {
  window.churnkey ??= { created: true }
  const src = `${EMBED_SCRIPT_URL}?appId=${encodeURIComponent(appId)}`
  let loadScript = scriptLoaders.get(src)
  if (!loadScript) {
    loadScript = createScriptLoader(src, () => window.churnkey?.init ?? null)
    scriptLoaders.set(src, loadScript)
  }
  return loadScript()
}

function churnkeyError(error: unknown, type?: string): Error {
  const baseError = toError(error)
  return type ? new Error(`${baseError.message} (${type})`) : baseError
}

export interface ChurnkeyShowOptions {
  workspaceId?: string
  isWorkspaceCurrent?: () => boolean
  handleCancel: (
    surveyResponse?: string | null,
    freeformFeedback?: string | null
  ) => Promise<ChurnkeyHandlerResult>
}

export interface ChurnkeySession {
  show: (options: ChurnkeyShowOptions) => Promise<ChurnkeySessionResults>
}

function rejectUnsupportedOffer(): Promise<never> {
  return Promise.reject(
    new Error(t('subscription.cancelDialog.offerUnavailable'))
  )
}

const discountSchema = z.object({
  percentOff: z.literal(30),
  duration: z.literal('repeating'),
  durationInMonths: z.literal(3),
  amountOff: z.union([z.literal(0), z.null()]).optional()
})

const stepSchema = z.object({
  stepType: z.string(),
  offer: z.object({ offerType: z.string() }).optional()
})

type SessionCredentials =
  | { provider: 'stripe'; auth: ChurnkeyAuthResponse; appId: string }
  | { provider: 'direct'; flow: ChurnkeyFlowResponse; appId: string }

function createSession(
  init: ChurnkeyInit,
  credentials: SessionCredentials
): ChurnkeySession {
  return {
    show: (options) =>
      new Promise<ChurnkeySessionResults>((resolve, reject) => {
        let settled = false
        let closing = false
        let outcome: ChurnkeySessionResults['outcome']
        let action:
          | {
              kind: 'cancel' | 'discount'
              promise: Promise<ChurnkeyHandlerResult>
            }
          | undefined
        let lastAction: Promise<ChurnkeyHandlerResult> | undefined
        let redemptionAttempted = false
        const recorded = new Set<string>()

        function runAction(
          kind: 'cancel' | 'discount',
          run: () => Promise<ChurnkeyHandlerResult>
        ) {
          if (action?.kind === kind) return action.promise
          if (closing || settled || action || outcome) {
            return Promise.reject(
              new Error(t('subscription.cancelDialog.retentionBusy'))
            )
          }
          const promise = Promise.resolve()
            .then(() => {
              if (options.isWorkspaceCurrent?.() === false)
                return Promise.reject(
                  new Error(t('subscription.cancelDialog.workspaceChanged'))
                )
              return run()
            })
            .then((result) => {
              outcome = kind === 'discount' ? 'retained' : 'canceled'
              return result
            })
            .catch((error) => {
              reportError(error, {
                errorType: 'churnkey_billing_action_failed',
                tags: { action: kind }
              })
              return Promise.reject(error)
            })
            .finally(() => {
              action = undefined
            })
          action = { kind, promise }
          lastAction = promise
          return promise
        }

        async function finish(results?: ChurnkeySessionResults, error?: Error) {
          if (closing || settled) return
          closing = true
          try {
            await lastAction
            if (error && !outcome) throw error
            settled = true
            resolve({
              ...results,
              ...(outcome ? { outcome, aborted: false } : {})
            })
          } catch (cause) {
            settled = true
            reject(toError(cause))
          } finally {
            window.churnkey?.clearState?.()
          }
        }

        function onError(error: unknown, type?: string) {
          if (closing || settled) return
          window.churnkey?.hide?.()
          void finish(undefined, churnkeyError(error, type))
        }

        function record(event: 'flow_opened' | 'offer_shown') {
          if (
            credentials.provider !== 'direct' ||
            !credentials.flow.experiment_variant ||
            recorded.has(event)
          )
            return
          if (options.isWorkspaceCurrent?.() === false) return
          recorded.add(event)
          void workspaceApi
            .recordChurnkeyFlowEvent({
              session_id: credentials.flow.session_id,
              event
            })
            .catch((error) => {
              recorded.delete(event)
              reportError(error, {
                errorType: 'churnkey_flow_event_failed',
                tags: { event }
              })
            })
        }

        const base = {
          appId: credentials.appId,
          authHash:
            credentials.provider === 'direct'
              ? credentials.flow.auth_hash
              : credentials.auth.auth_hash,
          mode:
            credentials.provider === 'direct'
              ? credentials.flow.mode
              : credentials.auth.mode,
          handleCancel: (
            _customer: unknown,
            survey?: string | null,
            feedback?: string | null
          ) =>
            runAction('cancel', () => options.handleCancel(survey, feedback)),
          onClose: (results: ChurnkeySessionResults) => {
            void finish(results)
          },
          onError
        }
        let config: ChurnkeyInitConfig
        if (credentials.provider === 'stripe') {
          config = {
            ...base,
            provider: 'stripe',
            customerId: credentials.auth.customer_id,
            handlePause: rejectUnsupportedOffer,
            handleDiscount: rejectUnsupportedOffer,
            handleTrialExtension: rejectUnsupportedOffer,
            handlePlanChange: rejectUnsupportedOffer,
            handleRebate: rejectUnsupportedOffer,
            handleRedirect: rejectUnsupportedOffer
          }
        } else {
          const { flow } = credentials
          const sub = flow.subscription
          config = {
            ...base,
            provider: 'direct',
            customer: { id: flow.customer_id },
            subscriptions: [
              {
                id: sub.id,
                start: new Date(sub.started_at * 1000),
                status: {
                  name: 'active',
                  currentPeriod: {
                    start: new Date(sub.period_start * 1000),
                    end: new Date(sub.period_end * 1000)
                  }
                },
                items: [
                  {
                    price: {
                      id: sub.price_id,
                      amount: {
                        value: sub.unit_amount,
                        currency: sub.currency
                      },
                      interval: sub.interval,
                      intervalCount: sub.interval_count
                    },
                    quantity: sub.quantity
                  }
                ]
              }
            ],
            onStepChange: (step) => {
              const parsed = stepSchema.safeParse(step)
              if (!parsed.success) return
              record('flow_opened')
              if (
                flow.allowed_offer &&
                parsed.data.stepType === 'OFFER' &&
                parsed.data.offer?.offerType === 'DISCOUNT'
              )
                record('offer_shown')
            },
            ...(flow.allowed_offer
              ? {
                  handleDiscount: (_customer: unknown, coupon: unknown) =>
                    runAction('discount', async () => {
                      if (!discountSchema.safeParse(coupon).success)
                        return rejectUnsupportedOffer()
                      if (
                        !redemptionAttempted &&
                        Date.now() >= flow.expires_at * 1000
                      )
                        return Promise.reject(
                          new Error(
                            t('subscription.cancelDialog.retentionExpired')
                          )
                        )
                      if (!options.workspaceId)
                        return Promise.reject(
                          new Error(
                            t('subscription.cancelDialog.workspaceChanged')
                          )
                        )
                      redemptionAttempted = true
                      const accepted =
                        await workspaceApi.acceptChurnkeyRetention(
                          flow.session_id
                        )
                      const operation =
                        await useBillingOperationStore().startOperation(
                          accepted.billing_op_id,
                          'retention',
                          {
                            workspaceId: options.workspaceId,
                            suppressProcessingToast: true
                          }
                        )
                      if (operation.status !== 'succeeded') {
                        return Promise.reject(
                          new Error(
                            t(
                              operation.status === 'failed'
                                ? 'subscription.cancelDialog.retentionFailed'
                                : 'subscription.cancelDialog.retentionPending'
                            )
                          )
                        )
                      }
                      return {
                        message: t('subscription.cancelDialog.retentionSuccess')
                      }
                    })
                }
              : {})
          }
        }
        try {
          void Promise.resolve(init('show', config)).catch(onError)
        } catch (error) {
          onError(error)
        }
      })
  }
}

export async function prepareChurnkey(): Promise<ChurnkeySession | null> {
  const configuredAppId = useFeatureFlags().flags.churnkeyAppId
  if (!configuredAppId) return null

  let credentials: SessionCredentials
  try {
    const flow = await workspaceApi.prepareChurnkeyFlow()
    credentials = { provider: 'direct', flow, appId: flow.app_id }
  } catch (error) {
    if (
      !(error instanceof WorkspaceApiError) ||
      !(
        error.status === 404 ||
        (error.status === 503 && error.code === 'CHURNKEY_NOT_CONFIGURED')
      )
    )
      throw error
    const auth = await workspaceApi.getChurnkeyAuth()
    credentials = { provider: 'stripe', auth, appId: configuredAppId }
  }
  return createSession(await loadChurnkey(credentials.appId), credentials)
}
