import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { ChurnkeySessionResponse } from '@/platform/cloud/churnkey/churnkeySessionSchema'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { toError } from '@/utils/errorUtil'
import { createScriptLoader } from '@/utils/loadExternalScript'

import type {
  ChurnkeyHandlerResult,
  ChurnkeyDirectSubscription,
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

function dateFromApi(value: string): Date {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid Churnkey subscription date: ${value}`)
  }
  return date
}

function directSubscription(
  session: ChurnkeySessionResponse
): ChurnkeyDirectSubscription {
  const { subscription } = session
  return {
    id: subscription.id,
    start: dateFromApi(subscription.started_at),
    status: {
      name: subscription.status,
      currentPeriod: {
        start: dateFromApi(subscription.current_period_start),
        end: dateFromApi(subscription.current_period_end)
      }
    },
    items: [
      {
        price: {
          id: subscription.plan.id,
          name: subscription.plan.name,
          amount: {
            value: subscription.plan.amount_cents,
            currency: subscription.plan.currency
          },
          interval: subscription.plan.interval,
          intervalCount: subscription.plan.interval_count
        },
        quantity: subscription.quantity
      }
    ]
  }
}

export interface ChurnkeyShowOptions {
  customerAttributes?: Record<string, string | number | boolean>
  handleCancel: (
    surveyResponse: string,
    freeformFeedback?: string
  ) => Promise<ChurnkeyHandlerResult>
}

export interface ChurnkeySession {
  show: (options: ChurnkeyShowOptions) => Promise<ChurnkeySessionResults>
}

function createSession(
  init: ChurnkeyInit,
  session: ChurnkeySessionResponse,
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
          authHash: session.auth_hash,
          provider: 'direct',
          mode: session.mode,
          customer: { id: session.customer_id },
          subscriptions: [directSubscription(session)],
          customerAttributes: options.customerAttributes,
          handleCancel: (_customer, surveyResponse, freeformFeedback) =>
            options.handleCancel(surveyResponse, freeformFeedback),
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

  const session = await workspaceApi.getChurnkeySession()
  if (!session) return null

  const init = await loadChurnkey(configuredAppId)
  return createSession(init, session, configuredAppId)
}
