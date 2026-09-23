import type { BillingEnvironment } from '@comfyorg/billing-contract'
/**
 * Which backend family this origin talks to, and the Firebase project whose
 * tokens that family accepts. One switch selects both, because a token minted
 * against one family is only valid inside it.
 *
 * `VITE_BILLING_ENV` names the family. Unset or misspelt resolves to `test`,
 * so a misconfigured deployment can never reach production Cloud.
 *
 * Firebase configuration arrives per deployment rather than baked in, because
 * this origin is hosted separately from the Cloud app. Partial configuration
 * yields no options at all: the app still boots and reports sign-in as
 * unavailable instead of throwing on its first import.
 */
import type { FirebaseOptions } from 'firebase/app'

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

export function cloudBaseUrlFor(env: BillingWebEnv): string {
  return CLOUD_BASE_URLS[env]
}

type EnvSource = Record<string, unknown>

function readString(source: EnvSource, name: string): string | undefined {
  const value = source[name]
  return typeof value === 'string' && value !== '' ? value : undefined
}

/**
 * The same option shape the Cloud app and the Workshop bake in, read from the
 * deployment instead. Everything Firebase Auth needs is required; the rest is
 * carried through when present.
 */
export function readFirebaseOptions(
  source: EnvSource
): FirebaseOptions | undefined {
  const apiKey = readString(source, 'VITE_FIREBASE_API_KEY')
  const authDomain = readString(source, 'VITE_FIREBASE_AUTH_DOMAIN')
  const projectId = readString(source, 'VITE_FIREBASE_PROJECT_ID')
  const appId = readString(source, 'VITE_FIREBASE_APP_ID')
  if (!apiKey || !authDomain || !projectId || !appId) return undefined
  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    databaseURL: readString(source, 'VITE_FIREBASE_DATABASE_URL'),
    storageBucket: readString(source, 'VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: readString(source, 'VITE_FIREBASE_MESSAGING_SENDER_ID'),
    measurementId: readString(source, 'VITE_FIREBASE_MEASUREMENT_ID')
  }
}

/** The family named in the contract's own vocabulary, where the names coincide. */
export const BILLING_WEB_ENV: BillingEnvironment = resolveBillingWebEnv(
  readString(import.meta.env, 'VITE_BILLING_ENV')
)

export const CLOUD_BASE_URL = cloudBaseUrlFor(BILLING_WEB_ENV)

export const FIREBASE_OPTIONS = readFirebaseOptions(import.meta.env)

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
