import type { ChurnkeyAuthResponse } from '@comfyorg/ingest-types'
import { createScriptLoader } from '@comfyorg/shared-frontend-utils/loadExternalScript'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { t } from '@/i18n'
import { reportError } from '@/platform/telemetry/reportError'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { toError } from '@/utils/errorUtil'

import type {
  ChurnkeyHandlerResult,
  ChurnkeyInit,
  ChurnkeyInitConfig,
  ChurnkeyOfferConfig,
  ChurnkeySessionOutcome
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
  handleCancel: (
    surveyResponse?: string | null,
    freeformFeedback?: string | null
  ) => Promise<ChurnkeyHandlerResult>
}

export interface ChurnkeySession {
  show: (options: ChurnkeyShowOptions) => Promise<ChurnkeySessionOutcome>
}

type RetentionState =
  | { type: 'undecided' }
  | { type: 'discounted' }
  | { type: 'cancelling'; cancellation: Promise<ChurnkeyHandlerResult> }

function rejectUnsupportedOffer(): Promise<never> {
  return Promise.reject(
    new Error(t('subscription.cancelDialog.offerUnavailable'))
  )
}

function createSession(
  init: ChurnkeyInit,
  auth: ChurnkeyAuthResponse,
  configuredAppId: string
): ChurnkeySession {
  const offerSubscriptionId = auth.offer_subscription_id
  return {
    show: (options) =>
      new Promise<ChurnkeySessionOutcome>((resolve, reject) => {
        let settled = false
        let retention: RetentionState = { type: 'undecided' }

        function settle(fn: () => void) {
          if (settled) return
          settled = true
          fn()
          window.churnkey?.clearState?.()
        }

        function handleCancel(
          surveyResponse?: string | null,
          freeformFeedback?: string | null
        ): Promise<ChurnkeyHandlerResult> {
          switch (retention.type) {
            case 'discounted':
              return Promise.reject(
                new Error(t('subscription.cancelDialog.discountApplied'))
              )
            case 'cancelling':
              return retention.cancellation
            case 'undecided': {
              const cancellation = options.handleCancel(
                surveyResponse,
                freeformFeedback
              )
              retention = { type: 'cancelling', cancellation }
              return cancellation
            }
          }
        }

        function recordDiscount() {
          if (settled) return
          switch (retention.type) {
            case 'undecided':
              retention = { type: 'discounted' }
              return
            case 'cancelling':
              reportError(
                new Error('Churnkey applied a discount during cancellation'),
                {
                  errorType:
                    'error_applying_churnkey_discount_during_cancellation'
                }
              )
              return
          }
        }

        const offerConfig: ChurnkeyOfferConfig = offerSubscriptionId
          ? { subscriptionId: offerSubscriptionId, onDiscount: recordDiscount }
          : { handleDiscount: rejectUnsupportedOffer }

        const config: ChurnkeyInitConfig = {
          appId: configuredAppId,
          authHash: auth.auth_hash,
          customerId: auth.customer_id,
          provider: 'stripe',
          mode: auth.mode,
          handleCancel: (_customer, surveyResponse, freeformFeedback) =>
            handleCancel(surveyResponse, freeformFeedback),
          handlePause: rejectUnsupportedOffer,
          ...offerConfig,
          handleTrialExtension: rejectUnsupportedOffer,
          handlePlanChange: rejectUnsupportedOffer,
          handleRebate: rejectUnsupportedOffer,
          handleRedirect: rejectUnsupportedOffer,
          onClose: (results) => {
            const closedOutcome: ChurnkeySessionOutcome = {
              type: results.aborted === true ? 'abandoned' : 'closed'
            }
            switch (retention.type) {
              case 'undecided':
                settle(() => resolve(closedOutcome))
                return
              case 'discounted':
                settle(() => resolve({ type: 'discount-applied' }))
                return
              case 'cancelling':
                void retention.cancellation.then(
                  () => settle(() => resolve(closedOutcome)),
                  (error) => settle(() => reject(toError(error)))
                )
                return
            }
          },
          onError: (error, type) => {
            if (settled) return
            settled = true
            window.churnkey?.hide?.()
            if (retention.type === 'discounted') {
              resolve({ type: 'discount-applied' })
              reportError(error, {
                errorType: 'error_displaying_churnkey_after_discount',
                context: { churnkeyErrorType: type }
              })
            } else {
              reject(churnkeyError(error, type))
            }
            queueMicrotask(() => window.churnkey?.clearState?.())
          }
        }

        try {
          init('show', config)
        } catch (error) {
          settle(() => {
            window.churnkey?.hide?.()
            reject(churnkeyError(error))
          })
        }
      })
  }
}

export async function prepareChurnkey(): Promise<ChurnkeySession | null> {
  const configuredAppId = useFeatureFlags().flags.churnkeyAppId
  if (!configuredAppId) return null

  const auth = await workspaceApi.getChurnkeyAuth()

  const init = await loadChurnkey(configuredAppId)
  return createSession(init, auth, configuredAppId)
}
