/**
 * One deployment for the whole suite: the `test` Cloud family, so every
 * request the app makes lands on `testcloud.comfy.org` and the mock answers
 * it. The Firebase project is not baked into the build; it comes from the
 * mocked `/api/features` response (see `fixtures/cloud.ts`), which serves
 * `E2E_FIREBASE_CONFIG`, matching how a real deployment resolves it.
 *
 * A fake publishable key is configured so the embedded checkout mounts; no
 * spec talks to real Stripe.js. A spec that does not fake `js.stripe.com`
 * (see `fixtures/stripe.ts`) never drives a request past the checkout's own
 * "payment form isn't available" gate, because none of the default fixture
 * scenarios set a `payment_method_configuration_id`.
 */
export const E2E_PORT = 4174
export const E2E_ORIGIN = `http://localhost:${E2E_PORT}`

export const CLOUD_ORIGIN = 'https://testcloud.comfy.org'

export const E2E_VITE_ENV = {
  VITE_BILLING_ENV: 'test',
  VITE_STRIPE_PUBLISHABLE_KEY: 'pk_e2e_fake_key_not_real'
} as const

export const E2E_FIREBASE_CONFIG = {
  apiKey: 'e2e-api-key',
  authDomain: 'e2e.firebaseapp.com',
  projectId: 'e2e',
  appId: '1:1:web:e2e'
} as const

export const E2E_USER = {
  uid: 'uid_e2e',
  email: 'billing-e2e@test.comfy.org',
  password: 'correct-horse-battery-staple',
  workspaceId: 'ws_e2e'
} as const

export const PORTAL_URL = 'https://billing-portal.test/session/e2e'
