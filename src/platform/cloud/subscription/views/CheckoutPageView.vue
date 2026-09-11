<template>
  <div
    class="flex min-h-screen w-screen items-center justify-center bg-base-background p-4 xl:p-10"
  >
    <div
      class="relative flex max-h-[920px] min-h-0 w-full max-w-6xl flex-1 overflow-hidden rounded-2xl border border-interface-stroke bg-secondary-background shadow-xl"
    >
      <SubscriptionRequiredDialogContentUnified
        :on-close="handleClose"
        :embedded-checkout-enabled="flags.embeddedCheckoutEnabled"
        :initial-plan-mode="initialPlanMode"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import SubscriptionRequiredDialogContentUnified from '@/platform/workspace/components/SubscriptionRequiredDialogContentUnified.vue'

const { flags } = useFeatureFlags()
const route = useRoute()
const router = useRouter()

const initialPlanMode = computed(() =>
  route.query.plans === 'team' ? ('team' as const) : ('personal' as const)
)

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
