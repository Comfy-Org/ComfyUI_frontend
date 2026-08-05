import type { ChurnkeyAuthResponse } from '@comfyorg/ingest-types'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { t } from '@/i18n'
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
  show: (options: ChurnkeyShowOptions) => Promise<ChurnkeySessionResults>
}

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
  return {
    show: (options) =>
      new Promise<ChurnkeySessionResults>((resolve, reject) => {
        let settled = false
        let pendingCancellation: Promise<ChurnkeyHandlerResult> | null = null

        function settle(fn: () => void) {
          if (settled) return
          settled = true
          fn()
          window.churnkey?.clearState?.()
        }

        const config: ChurnkeyInitConfig = {
          appId: configuredAppId,
          authHash: auth.auth_hash,
          customerId: auth.customer_id,
          provider: 'stripe',
          mode: auth.mode,
          handleCancel: (_customer, surveyResponse, freeformFeedback) => {
            pendingCancellation = options.handleCancel(
              surveyResponse,
              freeformFeedback
            )
            return pendingCancellation
          },
          handlePause: rejectUnsupportedOffer,
          handleDiscount: rejectUnsupportedOffer,
          handleTrialExtension: rejectUnsupportedOffer,
          handlePlanChange: rejectUnsupportedOffer,
          handleRebate: rejectUnsupportedOffer,
          handleRedirect: rejectUnsupportedOffer,
          onClose: (results) => {
            if (!pendingCancellation) {
              settle(() => resolve(results))
              return
            }
            void pendingCancellation.then(
              () => settle(() => resolve(results)),
              (error) => settle(() => reject(toError(error)))
            )
          },
          onError: (error, type) => {
            if (settled) return
            settled = true
            window.churnkey?.hide?.()
            reject(churnkeyError(error, type))
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
