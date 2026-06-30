import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { ChurnkeyAuthResponse } from '@/platform/workspace/api/workspaceApi'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'

import './embed-theme.css'
import { ChurnkeyAuthUnavailableError, ChurnkeyEmbedLoadError } from './errors'
import type {
  ChurnkeyHandlerResult,
  ChurnkeyInitConfig,
  ChurnkeySessionResults
} from './types'

const EMBED_SCRIPT_URL = 'https://assets.churnkey.co/js/app.js'

function readAppId(): string {
  return useFeatureFlags().flags.churnkeyAppId
}

function readAuthOverride(): ChurnkeyAuthResponse | null {
  // Dev-only manual-testing hook: set `window.__CHURNKEY_AUTH_OVERRIDE__` to
  // exercise the embed before the backend `/billing/churnkey/auth` endpoint
  // is deployed. It forges credentials, so it is gated to dev and stripped
  // from production builds via import.meta.env.DEV tree-shaking.
  if (!import.meta.env.DEV) return null
  return (
    (window as { __CHURNKEY_AUTH_OVERRIDE__?: ChurnkeyAuthResponse })
      .__CHURNKEY_AUTH_OVERRIDE__ ?? null
  )
}

export function isChurnkeyConfigured(): boolean {
  return !!readAppId()
}

let embedScriptPromise: Promise<void> | null = null

function injectEmbedScript(appId: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    window.churnkey ??= { created: true }
    const script = document.createElement('script')
    script.src = `${EMBED_SCRIPT_URL}?appId=${encodeURIComponent(appId)}`
    script.async = true
    script.onload = () => {
      if (window.churnkey?.init) resolve()
      else reject(new ChurnkeyEmbedLoadError())
    }
    script.onerror = () => {
      script.remove()
      reject(new ChurnkeyEmbedLoadError())
    }
    document.head.append(script)
  })
}

function loadEmbedScript(appId: string): Promise<void> {
  if (window.churnkey?.init) return Promise.resolve()
  embedScriptPromise ??= injectEmbedScript(appId).catch((err: unknown) => {
    // Clear the cached attempt so the next launch can retry the load.
    embedScriptPromise = null
    throw err
  })
  return embedScriptPromise
}

interface ChurnkeyShowOptions {
  handleCancel?: (
    surveyResponse: string,
    freeformFeedback?: string
  ) => Promise<ChurnkeyHandlerResult>
  onCancel?: (surveyResponse: string) => void
  customerAttributes?: Record<string, string | number>
}

export interface ChurnkeySession {
  /**
   * Opens the Churnkey modal. Resolves with the session results when the
   * modal closes; rejects only if `churnkey.init` itself throws.
   */
  show: (options: ChurnkeyShowOptions) => Promise<ChurnkeySessionResults>
}

/**
 * Loads the Churnkey embed script (on demand, cached) and fetches signed
 * auth credentials. Throws {@link ChurnkeyEmbedLoadError} or
 * {@link ChurnkeyAuthUnavailableError} so callers can fall back to the
 * legacy cancel dialog before any cancellation-funnel telemetry fires.
 */
export async function prepareChurnkey(): Promise<ChurnkeySession> {
  const appId = readAppId()
  if (!appId) {
    throw new Error(
      'Churnkey is not configured (churnkey_app_id flag is unset)'
    )
  }

  await loadEmbedScript(appId)
  const init = window.churnkey?.init
  if (!init) throw new ChurnkeyEmbedLoadError()

  const override = readAuthOverride()
  const auth = override ?? (await workspaceApi.getChurnkeyAuth())
  if (auth === null) {
    throw new ChurnkeyAuthUnavailableError()
  }

  // Arrow assignment (not a hoisted declaration) so the narrowing of
  // `init` and `auth` above carries into the closure.
  const show = (options: ChurnkeyShowOptions) =>
    new Promise<ChurnkeySessionResults>((resolve, reject) => {
      const config: ChurnkeyInitConfig = {
        appId,
        authHash: auth.auth_hash,
        customerId: auth.customer_id,
        provider: 'stripe',
        mode: auth.mode,
        record: true,
        customerAttributes: options.customerAttributes,
        onCancel: (_customer, surveyResponse) =>
          options.onCancel?.(surveyResponse),
        onClose: (results) => {
          // Reset Churnkey's cached session state so the next launch
          // restarts at step 1 (e.g. user visited Stripe but did not cancel).
          window.churnkey?.clearState?.()
          resolve(results)
        }
      }
      if (options.handleCancel) {
        const userHandleCancel = options.handleCancel
        config.handleCancel = (_customer, surveyResponse, freeformFeedback) =>
          userHandleCancel(surveyResponse, freeformFeedback)
      }
      try {
        init('show', config)
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })

  return { show }
}
