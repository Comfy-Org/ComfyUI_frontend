import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { ChurnkeyAuthResponse } from '@/platform/cloud/churnkey/churnkeyAuthSchema'
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

function rejectUnsupportedOffer(): Promise<never> {
  return Promise.reject(new Error('Unsupported ChurnKey offer'))
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

        function settle(fn: () => void) {
          if (settled) return
          settled = true
          runBestEffort(() => {
            window.churnkey?.clearState?.()
          })
          fn()
        }

        const config: ChurnkeyInitConfig = {
          appId: configuredAppId,
          authHash: auth.auth_hash,
          customerId: auth.customer_id,
          provider: 'stripe',
          mode: auth.mode,
          customerAttributes: options.customerAttributes,
          handleCancel: (_customer, surveyResponse, freeformFeedback) =>
            options.handleCancel(surveyResponse, freeformFeedback),
          handlePause: rejectUnsupportedOffer,
          handleDiscount: rejectUnsupportedOffer,
          handleTrialExtension: rejectUnsupportedOffer,
          handlePlanChange: rejectUnsupportedOffer,
          onClose: (results) => settle(() => resolve(results)),
          onError: (error, type) =>
            settle(() => {
              runBestEffort(() => {
                window.churnkey?.hide?.()
              })
              reject(churnkeyError(error, type))
            })
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
