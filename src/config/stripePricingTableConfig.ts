import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'

export const STRIPE_PRICING_TABLE_SCRIPT_SRC =
  'https://js.stripe.com/v3/pricing-table.js'

function getEnvValue(
  key: 'VITE_STRIPE_PUBLISHABLE_KEY' | 'VITE_STRIPE_PRICING_TABLE_ID'
) {
  return import.meta.env?.[key]
}

export function getStripePricingTableConfig() {
  const publishableKey =
    remoteConfig.value.stripe_publishable_key ||
    window.__CONFIG__?.stripe_publishable_key ||
    getEnvValue('VITE_STRIPE_PUBLISHABLE_KEY') ||
    ''

  const pricingTableId =
    remoteConfig.value.stripe_pricing_table_id ||
    window.__CONFIG__?.stripe_pricing_table_id ||
    getEnvValue('VITE_STRIPE_PRICING_TABLE_ID') ||
    ''

  return {
    publishableKey,
    pricingTableId
  }
}

export function hasStripePricingTableConfig() {
  const { publishableKey, pricingTableId } = getStripePricingTableConfig()
  return Boolean(publishableKey && pricingTableId)
}
