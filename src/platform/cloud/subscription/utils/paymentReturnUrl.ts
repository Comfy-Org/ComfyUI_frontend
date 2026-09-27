import { getComfyPlatformBaseUrl } from '@/config/comfyApi'

const STRIPE_RETURN_PARAMS = [
  'payment_intent',
  'payment_intent_client_secret',
  'redirect_status'
] as const

let paymentReturnPending = false

export function stripPaymentReturnParams(): void {
  const url = new URL(globalThis.location.href)
  const returnParams = STRIPE_RETURN_PARAMS.filter((param) =>
    url.searchParams.has(param)
  )
  if (returnParams.length === 0) return

  paymentReturnPending = true
  for (const param of returnParams) url.searchParams.delete(param)
  globalThis.history.replaceState(globalThis.history.state, '', url)
}

export function consumePaymentReturn(): boolean {
  stripPaymentReturnParams()
  const pending = paymentReturnPending
  paymentReturnPending = false
  return pending
}

/**
 * Where a redirect payment method (Alipay) or a hosted checkout sends the
 * customer afterwards. Returning to the page the checkout started on keeps
 * them in the app, where the pending-operation recovery on the next billing
 * status read resumes polling and completes the flow. Non-HTTP origins
 * (Electron) fall back to the platform success page: the backend requires an
 * absolute HTTP(S) return URL.
 */
export function paymentReturnUrl(): string {
  const { origin, pathname } = globalThis.location
  if (origin?.startsWith('https://') || origin?.startsWith('http://')) {
    return `${origin}${pathname}`
  }
  return `${getComfyPlatformBaseUrl()}/payment/success`
}
