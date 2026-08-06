import { getComfyPlatformBaseUrl } from '@/config/comfyApi'

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
