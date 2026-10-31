import type { BillingEnvironment } from '@comfyorg/billing-contract'

import { getBillingWebUrl } from '@/platform/billing/billingWeb'
import { isCloud } from '@/platform/distribution/types'
import { hostBillingEnvironment } from '@/platform/billing/hostedBillingRoutes'

const TOPUP_RETURN_PATH = '/return/topup'

const BILLING_WEB_ORIGINS: Readonly<Record<BillingEnvironment, string>> = {
  production: 'https://billing.comfy.org',
  staging: 'https://stagingbilling.comfy.org',
  test: 'https://testbilling.comfy.org'
}

interface TopupCheckoutReturnContext {
  readonly servesCloudWeb: boolean
  readonly currentUrl: string
  readonly billingWebBase: URL | null
  readonly environment: BillingEnvironment | undefined
}

function currentContext(): TopupCheckoutReturnContext {
  return {
    servesCloudWeb: isCloud && window.__comfyDesktop2 === undefined,
    currentUrl: window.location.href,
    billingWebBase: getBillingWebUrl(),
    environment: hostBillingEnvironment()
  }
}

/**
 * Where hosted top-up checkout returns: the current page on cloud web, else
 * billing-web's neutral return page; undefined when no billing-web origin resolves.
 */
export function topupCheckoutReturnUrl(
  context: TopupCheckoutReturnContext = currentContext()
): string | undefined {
  if (context.servesCloudWeb) return context.currentUrl

  const base =
    context.billingWebBase ??
    (context.environment && new URL(BILLING_WEB_ORIGINS[context.environment]))
  if (!base) return undefined

  const prefix = base.pathname.replace(/\/$/, '')
  return new URL(`${prefix}${TOPUP_RETURN_PATH}`, base.origin).href
}
