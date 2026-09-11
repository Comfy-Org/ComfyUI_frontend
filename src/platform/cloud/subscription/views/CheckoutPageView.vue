<template>
  <div class="flex min-h-screen w-screen flex-col bg-secondary-background">
    <SubscriptionRequiredDialogContentUnified
      :on-close="handleClose"
      :embedded-checkout-enabled="flags.embeddedCheckoutEnabled"
      :initial-checkout="initialCheckout"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import SubscriptionRequiredDialogContentUnified from '@/platform/workspace/components/SubscriptionRequiredDialogContentUnified.vue'
import type { SubscriptionCheckoutSelection } from '@/platform/workspace/composables/useSubscriptionCheckout'

const { flags } = useFeatureFlags()
const route = useRoute()
const router = useRouter()

// The splash loader is normally removed by the graph view's boot or the
// workspace auth gate; this route mounts outside both.
onMounted(() => {
  document.getElementById('splash-loader')?.remove()
})

// The plan arrives chosen (products deep-link it); this page is only the
// checkout. Plan selection gets its own full-page treatment separately.
const TIERS = ['standard', 'creator', 'pro'] as const
const tier = TIERS.find((t) => t === route.query.tier) ?? 'creator'
const billingCycle = route.query.cycle === 'yearly' ? 'yearly' : 'monthly'

const initialCheckout: SubscriptionCheckoutSelection = {
  planMode: 'personal',
  tierKey: tier,
  billingCycle
}

// Cross-product entry: /checkout?return=<url>. Only first-party origins may
// pull the customer back out; anything else lands on the workspace.
function safeReturnUrl(): URL | null {
  const raw = route.query.return
  if (typeof raw !== 'string') return null
  try {
    const url = new URL(raw)
    const host = url.hostname
    const firstParty =
      host === 'comfy.org' ||
      host.endsWith('.comfy.org') ||
      host === 'localhost'
    return firstParty && ['https:', 'http:'].includes(url.protocol) ? url : null
  } catch {
    return null
  }
}

function handleClose() {
  const returnUrl = safeReturnUrl()
  if (returnUrl) {
    window.location.assign(returnUrl.href)
    return
  }
  void router.push('/')
}
</script>
