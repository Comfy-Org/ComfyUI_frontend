<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { performSubscriptionCheckout } from '@/platform/cloud/subscription/utils/subscriptionCheckoutUtil'
import type { TierKey } from '@/platform/cloud/subscription/utils/subscriptionCheckoutUtil'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { reportError, accessBillingPortal } = useFirebaseAuthActions()
const { wrapWithErrorHandlingAsync } = useErrorHandling()

const { isActiveSubscription } = useSubscription()

const selectedTierKey = ref<TierKey | null>(null)

const getTierDisplayName = (tierKey: TierKey | null): string => {
  if (!tierKey) return ''
  const names: Record<TierKey, string> = {
    standard: t('subscription.tiers.standard.name'),
    creator: t('subscription.tiers.creator.name'),
    pro: t('subscription.tiers.pro.name')
  }
  return names[tierKey]
}

const runRedirect = wrapWithErrorHandlingAsync(async () => {
  const rawType = route.query.subscriptionType
  let tierKeyParam: string | null = null

  if (typeof rawType === 'string') {
    tierKeyParam = rawType
  } else if (Array.isArray(rawType) && rawType[0]) {
    tierKeyParam = rawType[0]
  }

  if (!tierKeyParam) {
    await router.push('/')
    return
  }

  const validTierKeys: TierKey[] = ['standard', 'creator', 'pro']
  if (!(validTierKeys as string[]).includes(tierKeyParam)) {
    await router.push('/')
    return
  }

  const tierKey = tierKeyParam as TierKey

  selectedTierKey.value = tierKey

  if (isActiveSubscription.value) {
    await accessBillingPortal()
  } else {
    await performSubscriptionCheckout(tierKey, false)
  }
}, reportError)

onMounted(() => {
  void runRedirect()
})
</script>

<template>
  <div
    class="flex h-full w-full items-center justify-center bg-comfy-menu-secondary-bg"
  >
    <div class="flex flex-col items-center gap-4">
      <img
        src="/assets/images/comfy-logo-single.svg"
        :alt="t('g.comfyOrgLogoAlt')"
        class="h-16 w-16"
      />
      <p
        v-if="selectedTierKey"
        class="font-inter text-base font-normal leading-normal text-base-foreground"
      >
        {{
          t('subscription.subscribeTo', {
            plan: getTierDisplayName(selectedTierKey)
          })
        }}
      </p>
    </div>
  </div>
</template>
