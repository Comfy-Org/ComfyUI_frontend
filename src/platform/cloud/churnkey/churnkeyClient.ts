import type { ChurnkeyAuthResponse } from '@comfyorg/ingest-types'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { i18n } from '@/i18n'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { toError } from '@/utils/errorUtil'
import { createScriptLoader } from '@/utils/loadExternalScript'

import type {
  ChurnkeyHandlerResult,
  ChurnkeyInit,
  ChurnkeyInitConfig,
  ChurnkeySessionResults
} from './types'

const EMBED_SCRIPT_URL = 'https://assets.churnkey.co/js/app.js'
const SESSION_TIMEOUT_MS = 30 * 60 * 1000

let churnkeyScript:
  | {
      src: string
      load: () => Promise<ChurnkeyInit>
    }
  | undefined

function loadChurnkey(appId: string): Promise<ChurnkeyInit> {
  window.churnkey ??= { created: true }
  const src = `${EMBED_SCRIPT_URL}?appId=${encodeURIComponent(appId)}`
  if (churnkeyScript?.src !== src) {
    churnkeyScript = {
      src,
      load: createScriptLoader(src, () => window.churnkey?.init ?? null)
    }
  }
  return churnkeyScript.load()
}

function churnkeyError(error: unknown, type?: string): Error {
  const baseError = toError(error)
  return type ? new Error(`${baseError.message} (${type})`) : baseError
}

function runBestEffort(cleanup: () => void): void {
  try {
    cleanup()
  } catch {
    return
  }
}

export interface ChurnkeyShowOptions {
  customerAttributes?: Record<string, string | number | boolean>
  handleCancel: (
    surveyResponse?: string | null,
    freeformFeedback?: string | null
  ) => Promise<ChurnkeyHandlerResult>
}

export interface ChurnkeySession {
  show: (options: ChurnkeyShowOptions) => Promise<ChurnkeySessionResults>
}

class UnsupportedChurnkeyOfferError extends Error {}

export function isUnsupportedChurnkeyOfferError(
  error: unknown
): error is UnsupportedChurnkeyOfferError {
  return error instanceof UnsupportedChurnkeyOfferError
}

function createSession(
  init: ChurnkeyInit,
  auth: ChurnkeyAuthResponse,
  configuredAppId: string
): ChurnkeySession {
  return {
    show: (options) =>
      new Promise<ChurnkeySessionResults>((resolve, reject) => {
        let settled = false
        let pendingCancellation: Promise<ChurnkeyHandlerResult> | null = null
        let unsupportedOfferError: UnsupportedChurnkeyOfferError | null = null

        function rejectUnsupportedOffer(): Promise<never> {
          unsupportedOfferError = new UnsupportedChurnkeyOfferError(
            'Unsupported ChurnKey offer'
          )
          return Promise.reject(unsupportedOfferError)
        }

        function settle(fn: () => void, { deferClearState = false } = {}) {
          if (settled) return
          settled = true
          window.clearTimeout(sessionTimeoutId)
          const clearState = () =>
            runBestEffort(() => {
              window.churnkey?.clearState?.()
            })
          if (deferClearState) {
            // ChurnKey checks its error state after onError returns.
            queueMicrotask(clearState)
          } else {
            clearState()
          }
          fn()
        }

        function settleAfterCancellation(
          fn: () => void,
          options?: { deferClearState?: boolean }
        ) {
          const cancellation = pendingCancellation
          if (!cancellation) {
            settle(fn, options)
            return
          }
          void cancellation.then(
            () => settle(fn, options),
            () => settle(fn, options)
          )
        }

        const sessionTimeoutId = window.setTimeout(() => {
          settle(() => {
            runBestEffort(() => {
              window.churnkey?.hide?.()
            })
            reject(new Error('ChurnKey session timed out'))
          })
        }, SESSION_TIMEOUT_MS)

        const config: ChurnkeyInitConfig = {
          appId: configuredAppId,
          authHash: auth.auth_hash,
          customerId: auth.customer_id,
          provider: 'stripe',
          mode: auth.mode,
          record: false,
          i18n: {
            lang: String(i18n.global.locale.value)
          },
          customerAttributes: options.customerAttributes,
          handleCancel: (_customer, surveyResponse, freeformFeedback) => {
            const cancellation = options.handleCancel(
              surveyResponse,
              freeformFeedback
            )
            pendingCancellation = cancellation
            void cancellation.then(
              () => {
                if (pendingCancellation === cancellation) {
                  pendingCancellation = null
                }
              },
              () => {
                if (pendingCancellation === cancellation) {
                  pendingCancellation = null
                }
              }
            )
            return cancellation
          },
          handlePause: rejectUnsupportedOffer,
          handleDiscount: rejectUnsupportedOffer,
          handleTrialExtension: rejectUnsupportedOffer,
          handlePlanChange: rejectUnsupportedOffer,
          handleRebate: rejectUnsupportedOffer,
          handleRedirect: rejectUnsupportedOffer,
          onClose: (results) => settleAfterCancellation(() => resolve(results)),
          onError: (error, type) => {
            runBestEffort(() => {
              window.churnkey?.hide?.()
            })
            settleAfterCancellation(
              () => {
                reject(unsupportedOfferError ?? churnkeyError(error, type))
              },
              { deferClearState: true }
            )
          }
        }

        try {
          init('show', config)
        } catch (error) {
          settle(() => {
            runBestEffort(() => {
              window.churnkey?.hide?.()
            })
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
  if (!auth) return null

  const init = await loadChurnkey(configuredAppId)
  return createSession(init, auth, configuredAppId)
}
