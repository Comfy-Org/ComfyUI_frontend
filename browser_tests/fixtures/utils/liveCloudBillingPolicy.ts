import type { LiveCloudBillingConfig } from '@e2e/fixtures/utils/liveCloudBillingConfig'

export function getLiveCloudDestinationViolation(
  url: URL,
  origins: ReadonlySet<string>,
  isNavigationRequest: boolean
): string | undefined {
  if (origins.has(url.origin)) return
  if (
    url.hostname.endsWith('.comfy.org') &&
    /^\/(api|customers)(\/|$)/.test(url.pathname)
  ) {
    return `API ${url.origin}${url.pathname}`
  }
  if (isNavigationRequest) {
    return `Navigation ${url.origin}${url.pathname}`
  }
}

export const LIVE_CHECKOUT_ORIGINS = [
  'https://checkout.stripe.com',
  'https://checkout.comfy.org',
  'https://api.stripe.com',
  'https://js.stripe.com',
  'https://m.stripe.network',
  'https://m.stripe.com',
  'https://r.stripe.com',
  'https://q.stripe.com',
  'https://b.stripecdn.com',
  'https://newassets.hcaptcha.com'
]

const AUXILIARY_POST_URLS = new Set([
  'https://www.google-analytics.com/g/collect',
  'https://www.google.com/ccm/collect',
  'https://ad.doubleclick.net/ccm/s/collect',
  'https://www.google.com/g/collect',
  'https://www.google.com/rmkt/collect/17902754986/',
  'https://analytics.google.com/g/collect',
  'https://stats.g.doubleclick.net/g/collect',
  'https://t.comfy.org/flags/',
  'https://cdp.customer.io/v1/p',
  'https://mpc-prod-27-s6uit34pua-uk.a.run.app/events',
  'https://5z-2b6b7616f94640c2840d1841e1ac24c3.ecs.us-east-1.on.aws/events',
  'https://www.facebook.com/tr/',
  'https://www.google.com/pagead/form-data/17902754986',
  'https://www.google.com/ccm/form-data/17902754986',
  'https://google.com/pagead/form-data/17902754986',
  'https://google.com/ccm/form-data/17902754986',
  'https://px.ads.linkedin.com/wa/',
  'https://consumer.cloud.gist.build/api/v4/users',
  'https://cdp.customer.io/v1/i',
  'https://www.google.com/measurement/conversion',
  'https://e2.sy-d.io/events',
  'https://cdp.customer.io/v1/t',
  'https://mp.comfy.org/track/',
  'https://mp.comfy.org/engage/'
])

export function isLiveCloudAuxiliaryPost(url: URL, method: string): boolean {
  return (
    method === 'POST' && AUXILIARY_POST_URLS.has(`${url.origin}${url.pathname}`)
  )
}

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS']

export function getBlockedRequestViolation(url: URL, method: string): string {
  const destination = `${url.origin}${url.pathname}`
  return SAFE_METHODS.includes(method.toUpperCase())
    ? `${method} ${destination}`
    : `Mutation ${method} ${destination}`
}

// A live run reports only these entries; an off-origin read the page happened
// to attempt is aborted either way and is not worth failing the run over.
export function isReportedViolation(violation: string): boolean {
  return /^(API|Navigation|Mutation|WebSocket) /.test(violation)
}

export function isLiveCloudMutationAllowed(
  url: URL,
  method: string,
  config: Pick<
    LiveCloudBillingConfig,
    | 'PLAYWRIGHT_SETUP_API_URL'
    | 'customerOrigin'
    | 'environment'
    | 'allowCheckout'
    | 'allowPayments'
    | 'allowAccountCreation'
  >,
  data?: unknown
): boolean {
  if (SAFE_METHODS.includes(method)) return true
  if (method !== 'POST') return false
  if (
    url.origin === config.PLAYWRIGHT_SETUP_API_URL &&
    url.pathname === '/api/settings'
  ) {
    return isOnboardingSurveyUpdate(data)
  }
  if (
    config.allowAccountCreation &&
    config.environment.stripeMode === 'test' &&
    url.origin === 'https://identitytoolkit.googleapis.com' &&
    url.pathname === '/v1/accounts:signUp'
  )
    return true
  if (
    config.allowPayments &&
    config.environment.stripeMode === 'test' &&
    isPaymentPostAllowed(url, config.PLAYWRIGHT_SETUP_API_URL)
  )
    return true
  if (url.origin === 'https://identitytoolkit.googleapis.com') {
    return ['/v1/accounts:signInWithPassword', '/v1/accounts:lookup'].includes(
      url.pathname
    )
  }
  if (url.origin === 'https://securetoken.googleapis.com') {
    return url.pathname === '/v1/token'
  }
  if (
    config.allowCheckout &&
    isCheckoutPostAllowed(
      url,
      config.PLAYWRIGHT_SETUP_API_URL,
      config.environment.stripeMode
    )
  )
    return true
  if (url.pathname === '/customers') {
    return url.origin === config.customerOrigin
  }
  return (
    url.origin === config.PLAYWRIGHT_SETUP_API_URL &&
    [
      '/api/auth/token',
      '/api/auth/session',
      '/api/settings/Comfy.InstalledVersion',
      '/api/settings/Comfy.OnboardingCoachmarks.Seen'
    ].includes(url.pathname)
  )
}

function isOnboardingSurveyUpdate(data: unknown): boolean {
  return (
    typeof data === 'object' &&
    data !== null &&
    Object.keys(data).length === 1 &&
    'onboarding_survey' in data &&
    typeof data.onboarding_survey === 'object' &&
    data.onboarding_survey !== null
  )
}

function isPaymentPostAllowed(url: URL, backend: string): boolean {
  if (
    url.origin === 'https://checkout.comfy.org' &&
    url.pathname === '/ajax/metrics_batch'
  )
    return true
  if (url.origin === backend && url.pathname === '/api/billing/payment-portal')
    return true
  return (
    url.origin === 'https://api.stripe.com' &&
    (url.pathname === '/v1/payment_methods' ||
      /^\/v1\/payment_pages\/cs_test_[A-Za-z0-9]+\/confirm$/.test(url.pathname))
  )
}

function isCheckoutPostAllowed(
  url: URL,
  backend: string,
  mode: 'live' | 'test'
): boolean {
  if (url.origin === backend) {
    return [
      '/api/billing/preview-subscribe',
      '/api/billing/subscribe'
    ].includes(url.pathname)
  }
  if (url.origin === 'https://api.stripe.com') {
    return new RegExp(`^/v1/payment_pages/cs_${mode}_[A-Za-z0-9]+/init$`).test(
      url.pathname
    )
  }
  return (
    (url.origin === 'https://r.stripe.com' &&
      ['/b', '/0'].includes(url.pathname)) ||
    (url.origin === 'https://m.stripe.com' && url.pathname === '/6')
  )
}
