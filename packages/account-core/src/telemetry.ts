/**
 * Shared telemetry vocabulary. The event names match the cloud app's
 * TelemetryEvents verbatim so an auth outcome is one queryable event across
 * every host. The package never calls a telemetry API itself; call sites
 * stay host-specific.
 */
import { z } from 'zod'

import type {
  WebSessionBootstrapEvent,
  WebSessionIdentityOptions
} from './core/webSessionIdentity.js'
import type { SsoErrorCode } from './sso.js'

export const SESSION_TELEMETRY_EVENT = {
  refreshSucceeded: 'auth.unified.refresh.succeeded',
  refreshFailed: 'auth.unified.refresh.failed',
  bootstrap: 'session_bootstrap',
  signedOutRemotely: 'session_signed_out_remotely'
} as const

export type WebSessionTelemetryEvent =
  | {
      readonly name: typeof SESSION_TELEMETRY_EVENT.bootstrap
      readonly properties: WebSessionBootstrapEvent
    }
  | {
      readonly name: typeof SESSION_TELEMETRY_EVENT.signedOutRemotely
      readonly properties: { readonly origin: string }
    }

/** The web-session identity's telemetry hooks, routed to one host sink. */
export function webSessionTelemetryHooks(
  track: (event: WebSessionTelemetryEvent) => void
): Pick<WebSessionIdentityOptions, 'onBootstrap' | 'onSignedOutRemotely'> {
  return {
    onBootstrap: ({ outcome, origin }) =>
      track({
        name: SESSION_TELEMETRY_EVENT.bootstrap,
        properties: { outcome, origin }
      }),
    onSignedOutRemotely: ({ origin }) =>
      track({
        name: SESSION_TELEMETRY_EVENT.signedOutRemotely,
        properties: { origin }
      })
  }
}

/**
 * The cloud app's `billing.operation.*` events, emitted by the billing
 * operation lifecycle for every observed `billing_op_id` regardless of
 * which presentation settled it.
 */
export const BILLING_OPERATION_TELEMETRY_EVENT = {
  started: 'billing.operation.started',
  succeeded: 'billing.operation.succeeded',
  failed: 'billing.operation.failed',
  timeout: 'billing.operation.timeout'
} as const

/**
 * Payment friction the lifecycle observes inside one operation: a bank
 * challenge and its verdict, each retryable decline, and a hosted step the
 * customer was sent to and came back from.
 */
export const BILLING_CHECKOUT_FRICTION_TELEMETRY_EVENT = {
  challengeRequired: 'billing.checkout.challenge_required',
  challengeCompleted: 'billing.checkout.challenge_completed',
  challengeFailed: 'billing.checkout.challenge_failed',
  redirectStarted: 'billing.checkout.redirect_started',
  returned: 'billing.checkout.returned'
} as const

export const AUTH_TELEMETRY_EVENT = {
  signUpOpened: 'app:user_sign_up_opened',
  authCompleted: 'app:user_auth_completed',
  authFailed: 'app:user_auth_failed'
} as const

export type AuthMethod = 'email' | 'google' | 'github'

/** What the cloud app reports on every successful credential. */
export interface AuthCompletedMetadata {
  method: AuthMethod
  is_new_user: boolean
  user_id: string
  email?: string
}

export type AuthFlowAction =
  | 'email_sign_in'
  | 'email_sign_up'
  | 'google_sign_in'
  | 'google_sign_up'
  | 'github_sign_in'
  | 'github_sign_up'
  | 'password_reset'

export interface AuthErrorMetadata {
  error_code: string
  auth_action: AuthFlowAction
}

export const SSO_TELEMETRY_EVENT = {
  requiredShown: 'app:sso_required_shown',
  continueClicked: 'app:sso_continue_clicked',
  signInFailed: 'app:sso_sign_in_failed',
  signInCompleted: 'app:sso_sign_in_completed',
  workspaceLanded: 'app:sso_workspace_landed'
} as const

const SSO_SURFACES = [
  'cloud_login',
  'cloud_signup',
  'cloud_customer_create',
  'cloud_app',
  'billing_web',
  'platform',
  'desktop',
  'local_web'
] as const

/** Where an SSO attempt started; `cloud_app` is the in-app dialog. */
export type SsoSurface = (typeof SSO_SURFACES)[number]

/** The refusal that showed the SSO-required screen. */
export type SsoRequiredTrigger =
  | 'firebase_sign_in'
  | 'api_key'
  | 'customer_create'
  | 'session_refused'
  | 'session_expired'

/**
 * `notice` waits for the person to continue; `redirect` sends them straight
 * to SSO, so no `sso_continue_clicked` follows.
 */
export type SsoRequiredPresentation = 'notice' | 'redirect'

export type SsoSignInFailureReason =
  | 'cancelled'
  | 'state_mismatch'
  | 'org_not_attached'
  | 'server_error'
  | 'network'

interface SsoFlowProperties {
  readonly surface: SsoSurface
  readonly flow_id: string
}

/** IDs and enums only: never an email, a name or an organization name. */
export type SsoTelemetryEvent =
  | {
      readonly name: typeof SSO_TELEMETRY_EVENT.requiredShown
      readonly properties: SsoFlowProperties & {
        readonly trigger: SsoRequiredTrigger
        readonly presentation: SsoRequiredPresentation
      }
    }
  | {
      readonly name: typeof SSO_TELEMETRY_EVENT.continueClicked
      readonly properties: SsoFlowProperties
    }
  | {
      readonly name: typeof SSO_TELEMETRY_EVENT.signInFailed
      readonly properties: SsoFlowProperties & {
        readonly reason: SsoSignInFailureReason
        readonly http_status?: number
      }
    }
  | {
      readonly name: typeof SSO_TELEMETRY_EVENT.signInCompleted
      readonly properties: SsoFlowProperties
    }
  | {
      readonly name: typeof SSO_TELEMETRY_EVENT.workspaceLanded
      readonly properties: SsoFlowProperties & {
        readonly landed_in_default_workspace: boolean
      }
    }

const SSO_FAILURE_REASON: Partial<
  Readonly<Record<SsoErrorCode, SsoSignInFailureReason>>
> = {
  SSO_INVALID_STATE: 'state_mismatch',
  SSO_CONFIRM_EXPIRED: 'state_mismatch',
  SSO_ORG_NOT_ATTACHED: 'org_not_attached',
  SSO_ORG_MISMATCH: 'org_not_attached'
}

/** Reduces an `?sso_error=` code to the reason telemetry reports. */
export function ssoFailureReason(code: SsoErrorCode): SsoSignInFailureReason {
  return SSO_FAILURE_REASON[code] ?? 'server_error'
}

/** One SSO attempt; `flowId` joins its steps across the IdP redirect. */
export interface SsoFlow {
  readonly flowId: string
  readonly surface: SsoSurface
  /** Set once the person chose to continue to SSO. */
  readonly continued?: boolean
}

const SSO_FLOW_STORAGE_KEY = 'Comfy.Sso.TelemetryFlow'

const zSsoFlow = z.object({
  flowId: z.string().min(1),
  surface: z.enum(SSO_SURFACES),
  continued: z.boolean().optional()
})

function randomBytes(): Uint8Array {
  const bytes = new Uint8Array(16)
  try {
    return crypto.getRandomValues(bytes)
  } catch {
    return bytes.map(() => Math.floor(Math.random() * 256))
  }
}

/** `getRandomValues`, unlike `randomUUID`, also works outside a secure context. */
function newFlowId(): string {
  return Array.from(randomBytes(), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')
}

export function createSsoFlow(surface: SsoSurface): SsoFlow {
  return { flowId: newFlowId(), surface }
}

/**
 * Keeps the current attempt in session storage across the redirect, and in
 * memory for this page when storage fails, so telemetry never fails a sign-in.
 */
export function createSsoFlowStore(storage: () => Storage) {
  let inMemory: SsoFlow | undefined

  function readStored(): SsoFlow | undefined {
    try {
      const raw = storage().getItem(SSO_FLOW_STORAGE_KEY)
      if (raw === null) return undefined
      const parsed = zSsoFlow.safeParse(JSON.parse(raw))
      return parsed.success ? parsed.data : undefined
    } catch {
      return undefined
    }
  }

  function save(flow: SsoFlow): SsoFlow {
    inMemory = flow
    try {
      storage().setItem(SSO_FLOW_STORAGE_KEY, JSON.stringify(flow))
    } catch {
      return flow
    }
    return flow
  }

  function start(surface: SsoSurface, continued = false): SsoFlow {
    return save({ ...createSsoFlow(surface), ...(continued && { continued }) })
  }

  function current(): SsoFlow | undefined {
    return inMemory ?? readStored()
  }

  /** Marks the current attempt, or a new one from `surface`, as continued. */
  function markContinued(surface: SsoSurface): SsoFlow {
    return save({ ...(current() ?? createSsoFlow(surface)), continued: true })
  }

  function finish(): SsoFlow | undefined {
    const flow = current()
    inMemory = undefined
    try {
      storage().removeItem(SSO_FLOW_STORAGE_KEY)
    } catch {
      return flow
    }
    return flow
  }

  /** Drops an attempt the person never continued. */
  function abandon(): void {
    if (current()?.continued) return
    finish()
  }

  return { start, current, markContinued, finish, abandon }
}

export const ssoFlowStore = createSsoFlowStore(() => globalThis.sessionStorage)
