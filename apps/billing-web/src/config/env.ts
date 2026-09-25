/**
 * Which backend family this origin talks to. It selects the Cloud origin
 * that names this deployment's Firebase project through its own
 * `/api/features`, because a token minted against one family is only valid
 * inside it.
 *
 * The family is derived from the hostname the app is served from, since that
 * is the one thing guaranteed to match the actual deployment. `VITE_BILLING_ENV`
 * overrides it when set to a recognised value; otherwise an unrecognised
 * hostname resolves to `test`, so a misconfigured deployment can never reach
 * production Cloud by accident.
 *
 * Firebase configuration is not part of this module: it comes from the Cloud
 * origin's own `/api/features` at runtime, read by `@/config/firebase`. This
 * origin never bakes in a Firebase project of its own.
 */
import type { BillingEnvironment } from '@comfyorg/billing-contract'

const BILLING_WEB_ENVS = ['production', 'staging', 'test'] as const

export type BillingWebEnv = (typeof BILLING_WEB_ENVS)[number]

const CLOUD_BASE_URLS: Record<BillingWebEnv, string> = {
  production: 'https://cloud.comfy.org',
  staging: 'https://stagingcloud.comfy.org',
  test: 'https://testcloud.comfy.org'
}

export function resolveBillingWebEnv(value: unknown): BillingWebEnv {
  return BILLING_WEB_ENVS.find((env) => env === value) ?? 'test'
}

const HOST_ENVS: Record<string, BillingWebEnv> = {
  'billing.comfy.org': 'production',
  'stagingbilling.comfy.org': 'staging',
  'testbilling.comfy.org': 'test'
}

/** Exact hostnames only: a suffix or substring match would let a lookalike domain claim production. */
function resolveHostEnv(
  hostname: string | undefined
): BillingWebEnv | undefined {
  return hostname === undefined ? undefined : HOST_ENVS[hostname]
}

/** Never throws: this module also loads under happy-dom and in plain Node, where `location` can be missing or unusable. */
export function currentHostname(): string | undefined {
  try {
    const { location } = globalThis as { location?: { hostname?: unknown } }
    return typeof location?.hostname === 'string'
      ? location.hostname
      : undefined
  } catch {
    return undefined
  }
}

/**
 * Which family this deployment talks to must agree with the origin it is
 * actually served from, or the mismatch is silent and total: wrong backend,
 * blocked by CORS, no working fallback. Deriving it from the hostname keeps
 * it from carrying that fact separately, where it can silently disagree.
 * `VITE_BILLING_ENV` remains an explicit override for what the hostname
 * alone can't say, such as staging or preview deployments.
 */
export function resolveDeployedBillingWebEnv(
  explicitValue: unknown,
  hostname: string | undefined
): BillingWebEnv {
  const explicit = BILLING_WEB_ENVS.find((env) => env === explicitValue)
  return (
    explicit ?? resolveHostEnv(hostname) ?? resolveBillingWebEnv(explicitValue)
  )
}

export function cloudBaseUrlFor(env: BillingWebEnv): string {
  return CLOUD_BASE_URLS[env]
}

type EnvSource = Record<string, unknown>

function readString(source: EnvSource, name: string): string | undefined {
  const value = source[name]
  return typeof value === 'string' && value !== '' ? value : undefined
}

/** The family named in the contract's own vocabulary, where the names coincide. */
export const BILLING_WEB_ENV: BillingEnvironment = resolveDeployedBillingWebEnv(
  readString(import.meta.env, 'VITE_BILLING_ENV'),
  currentHostname()
)

export const CLOUD_BASE_URL = cloudBaseUrlFor(BILLING_WEB_ENV)

/**
 * Absent in a deployment that configures no key: the checkout form then
 * reports itself unavailable and no payment can be started from this app. The
 * lifecycle's hosted continuation resumes an operation that already exists; it
 * is not a way to open one.
 */
export const STRIPE_PUBLISHABLE_KEY = readString(
  import.meta.env,
  'VITE_STRIPE_PUBLISHABLE_KEY'
)

/** Password recovery stays a single flow, owned by the Cloud app's own page. */
export const CLOUD_FORGOT_PASSWORD_URL = `${CLOUD_BASE_URL}/cloud/forgot-password`
