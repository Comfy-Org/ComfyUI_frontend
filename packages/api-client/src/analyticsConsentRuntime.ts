import { zStoredPostHogConsentSetting } from '@comfyorg/ingest-types/homepage-consent'
import { zErrorResponse } from '@comfyorg/ingest-types/zod'
import type { SessionTokenResult } from '@comfyorg/account-core/sessionTokenMint'
type AccountCredential = Extract<
  SessionTokenResult,
  { status: 'ok' }
>['credential']
import {
  analyticsConsentReceiptKey,
  createAnalyticsConsentReceiptBridge
} from './analyticsConsentReceiptBridge'
import type {
  ConsentReceiptConfiguration,
  ConsentReceiptTransport
} from './analyticsConsentReceiptBridge'

export const homepageConsentReceiptConfiguration: Readonly<ConsentReceiptConfiguration> =
  Object.freeze({
    enabled: false,
    policyVersion: '',
    noticeDigest: ''
  })

/** Uses one immutable workspace JWT; credentials and account IDs never enter the grant body. */
export function createAnalyticsConsentTransport(
  apiBaseUrl: string,
  credential: AccountCredential,
  isCurrent: () => boolean,
  fetchImpl: typeof fetch = fetch
): ConsentReceiptTransport {
  const { token, uid, expiresAt } = credential
  const workspaceId = credential.workspace.id
  const url = `${apiBaseUrl.replace(/\/$/, '')}/global-settings`
  const usable = () =>
    isCurrent() &&
    Date.now() < expiresAt &&
    token.length > 0 &&
    uid.length > 0 &&
    workspaceId.length > 0 &&
    !token.startsWith('comfyui-')
  const send = async (path: string, init: RequestInit) => {
    if (!usable()) return undefined
    let response: Response
    try {
      response = await fetchImpl(path, {
        ...init,
        credentials: 'omit',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
    } catch {
      return undefined
    }
    if (!usable()) return undefined
    return response
  }
  const body = async (response: Response): Promise<unknown> => {
    try {
      return await response.json()
    } catch {
      return undefined
    }
  }
  return {
    async grant(receipt) {
      const response = await send(url, {
        method: 'POST',
        body: JSON.stringify({
          key: analyticsConsentReceiptKey,
          value: receipt
        })
      })
      if (!response?.ok) return false
      const result = zStoredPostHogConsentSetting.safeParse(
        await body(response)
      )
      if (
        !usable() ||
        !result.success ||
        result.data.scope.actor_id !== uid ||
        result.data.scope.workspace_id !== workspaceId ||
        result.data.value.policy_version !== receipt.policy_version ||
        result.data.value.notice_digest !== receipt.notice_digest
      )
        return false
      return true
    },
    async revoke() {
      const response = await send(
        `${url}/${encodeURIComponent(analyticsConsentReceiptKey)}`,
        { method: 'DELETE' }
      )
      if (response?.status === 204) return true
      if (response?.status === 404) {
        const parsed = zErrorResponse.safeParse(await body(response))
        if (usable() && parsed.success && parsed.data.code === 'NOT_FOUND')
          return true
      }
      return false
    }
  }
}

export interface AnalyticsConsentRuntimePorts {
  apiBaseUrl: string
  fetchImpl?: typeof fetch
  onSession: (
    listener: (credential: AccountCredential | undefined) => void
  ) => () => void
  onPostHogConsent: (
    listener: (explicitConsent: boolean | undefined) => void
  ) => () => void
  setEligible: (eligible: boolean) => void
}

/** Binds configured service-consent and authenticated session changes without changing telemetry initialization. */
export function bindAnalyticsConsentRuntime(
  configuration: Readonly<ConsentReceiptConfiguration>,
  ports: AnalyticsConsentRuntimePorts
) {
  let generation = 0
  let disposed = false
  let consent: boolean | undefined
  let expiry: ReturnType<typeof setTimeout> | undefined
  let bridge: ReturnType<typeof createAnalyticsConsentReceiptBridge> | undefined
  ports.setEligible(false)
  if (!configuration.enabled) return { dispose: () => ports.setEligible(false) }
  const stopConsent = ports.onPostHogConsent((value) => {
    consent = value
    void bridge?.update(value)
  })
  const stopSession = ports.onSession((credential) => {
    const revision = ++generation
    clearTimeout(expiry)
    bridge?.dispose()
    bridge = undefined
    ports.setEligible(false)
    if (disposed || !credential) return
    const isCurrent = () => !disposed && revision === generation
    bridge = createAnalyticsConsentReceiptBridge(
      configuration,
      createAnalyticsConsentTransport(
        ports.apiBaseUrl,
        credential,
        isCurrent,
        ports.fetchImpl
      ),
      ports.setEligible
    )
    expiry = setTimeout(
      () => {
        if (isCurrent()) {
          ++generation
          bridge?.dispose()
          bridge = undefined
          ports.setEligible(false)
        }
      },
      Math.max(0, Math.min(credential.expiresAt - Date.now(), 2_147_483_647))
    )
    void bridge.update(consent)
  })
  return {
    dispose() {
      disposed = true
      ++generation
      clearTimeout(expiry)
      bridge?.dispose()
      stopConsent()
      stopSession()
      ports.setEligible(false)
    }
  }
}
