/**
 * The versioned URL contract every Comfy product uses to hand a customer to
 * the hosted billing app, and that the app reads back on arrival.
 *
 * The entry URL is routing input and nothing more. It never carries a token,
 * a JWT, a payment-provider secret, an authoritative price, or a caller-chosen
 * return URL: a product states which billing screen it wants, which product is
 * asking, and which registered destination the customer should land on
 * afterwards. Billing resolves everything else against its own environment and
 * the signed-in session, so a workspace id here is a requested scope and never
 * an authorization.
 *
 * Route and parameter names are provisional while the hosted app is behind a
 * flag. `BILLING_CONTRACT_VERSION` is what lets them change without stranding
 * a product that is already deployed against the older shape.
 *
 * Whether a payment renders embedded or hosted is not decided here — that is
 * the SDK core's `hostedDestination` port. This package stays dependency-free
 * and framework-free so a product, the billing app, and a future non-Vue host
 * can share exactly one definition of the route surface.
 */
export const BILLING_CONTRACT_VERSION = 'v1'

export const BILLING_INTENTS = [
  'pricing',
  'checkout',
  'subscription',
  'payment-methods',
  'invoices',
  'result'
] as const

export type BillingIntent = (typeof BILLING_INTENTS)[number]

export function isBillingIntent(
  value: string | null | undefined
): value is BillingIntent {
  return BILLING_INTENTS.some((intent) => intent === value)
}

/** The route an intent occupies, e.g. `/v1/checkout`. */
export function billingIntentPath(intent: BillingIntent): string {
  return `/${BILLING_CONTRACT_VERSION}/${intent}`
}

/** The surfaces allowed to originate a billing trip. */
export const BILLING_PRODUCTS = [
  'comfyui',
  'platform',
  'workshop',
  'models'
] as const

export type BillingProduct = (typeof BILLING_PRODUCTS)[number]

export function isBillingProduct(
  value: string | null | undefined
): value is BillingProduct {
  return BILLING_PRODUCTS.some((product) => product === value)
}

/**
 * Which deployment family a return destination belongs to. The backends run
 * three of them, not two, and pair each origin with exactly one family, so a
 * product resolves its return target in the same family its session was
 * minted against.
 *
 * A host picks its family by origin, never by the label on its own build: the
 * cloud app's "staging" distribution points at `testcloud.comfy.org`
 * (`STAGING_CLOUD_BASE_URL` in `src/config/comfyApi.ts`) and therefore maps to
 * `test` here, while `staging` means `stagingcloud.comfy.org`.
 */
export type BillingEnvironment = 'production' | 'staging' | 'test'
