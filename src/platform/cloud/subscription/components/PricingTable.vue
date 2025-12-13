<template>
  <div class="flex flex-row items-stretch gap-6">
    <div
      v-for="tier in tiers"
      :key="tier.id"
      class="flex-1 flex flex-col rounded-2xl border border-interface-stroke bg-interface-panel-surface shadow-[0_0_12px_rgba(0,0,0,0.1)]"
    >
      <div class="flex flex-col gap-6 p-8">
        <div class="flex flex-row items-center gap-2">
          <span
            class="font-inter text-base font-bold leading-normal text-base-foreground"
          >
            {{ tier.name }}
          </span>
          <div
            v-if="tier.isPopular"
            class="rounded-full bg-background px-1 text-xs font-semibold uppercase tracking-wide text-foreground h-[13px] leading-[13px]"
          >
            {{ t('subscription.mostPopular') }}
          </div>
        </div>
        <div class="flex flex-row items-baseline gap-2">
          <span
            class="font-inter text-[32px] font-semibold leading-normal text-base-foreground"
          >
            ${{ tier.price }}
          </span>
          <span
            class="font-inter text-base font-normal leading-normal text-base-foreground"
          >
            {{ t('subscription.usdPerMonth') }}
          </span>
        </div>
      </div>

      <div class="flex flex-col gap-4 px-8 pb-0 flex-1">
        <div class="flex flex-row items-center justify-between">
          <span
            class="font-inter text-sm font-normal leading-normal text-muted-foreground"
          >
            {{ t('subscription.monthlyCreditsLabel') }}
          </span>
          <div class="flex flex-row items-center gap-1">
            <i class="icon-[lucide--component] text-amber-400 text-sm" />
            <span
              class="font-inter text-sm font-bold leading-normal text-base-foreground"
            >
              {{ tier.credits }}
            </span>
          </div>
        </div>

        <div class="flex flex-row items-center justify-between">
          <span class="text-sm font-normal text-muted-foreground">
            {{ t('subscription.maxDurationLabel') }}
          </span>
          <span
            class="font-inter text-sm font-bold leading-normal text-base-foreground"
          >
            {{ tier.maxDuration }}
          </span>
        </div>

        <div class="flex flex-row items-center justify-between">
          <span class="text-sm font-normal text-muted-foreground">
            {{ t('subscription.gpuLabel') }}
          </span>
          <i class="pi pi-check text-xs text-success-foreground" />
        </div>

        <div class="flex flex-row items-center justify-between">
          <span class="text-sm font-normal text-muted-foreground">
            {{ t('subscription.addCreditsLabel') }}
          </span>
          <i class="pi pi-check text-xs text-success-foreground" />
        </div>

        <div class="flex flex-row items-center justify-between">
          <span class="text-sm font-normal text-muted-foreground">
            {{ t('subscription.customLoRAsLabel') }}
          </span>
          <i
            v-if="tier.customLoRAs"
            class="pi pi-check text-xs text-success-foreground"
          />
          <i v-else class="pi pi-times text-xs text-muted-foreground" />
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex flex-row items-start justify-between">
            <div class="flex flex-col gap-2">
              <span class="text-sm font-normal text-muted-foreground">
                {{ t('subscription.videoEstimateLabel') }}
              </span>
              <div class="flex flex-row items-center gap-2 opacity-50">
                <i
                  class="pi pi-question-circle text-xs text-muted-foreground"
                />
                <span
                  class="text-sm font-normal text-muted-foreground cursor-pointer hover:text-base-foreground"
                  @click="togglePopover"
                >
                  {{ t('subscription.videoEstimateHelp') }}
                </span>
              </div>
            </div>
            <span
              class="font-inter text-sm font-bold leading-normal text-base-foreground"
            >
              {{ tier.videoEstimate }}
            </span>
          </div>
        </div>
      </div>

      <div class="flex flex-col p-8">
        <Button
          :label="getButtonLabel(tier)"
          :severity="getButtonSeverity(tier)"
          :disabled="isLoading || isCurrentPlan(tier.key)"
          :loading="loadingTier === tier.key"
          class="h-10 w-full"
          :pt="{
            label: {
              class: getButtonTextClass(tier)
            }
          }"
          @click="() => handleSubscribe(tier.key)"
        />
      </div>
    </div>
  </div>

  <!-- Video Estimate Help Popover -->
  <Popover
    ref="popover"
    append-to="body"
    :auto-z-index="true"
    :base-z-index="1000"
    :dismissable="true"
    :close-on-escape="true"
    unstyled
    :pt="{
      root: {
        class:
          'rounded-lg border border-interface-stroke bg-interface-panel-surface shadow-lg p-4 max-w-xs'
      }
    }"
  >
    <div class="flex flex-col gap-2">
      <p class="text-sm text-base-foreground">
        {{ t('subscription.videoEstimateExplanation') }}
      </p>
      <a
        href="https://cloud.comfy.org/?template=video_wan2_2_14B_fun_camera"
        target="_blank"
        rel="noopener noreferrer"
        class="text-sm text-azure-600 hover:text-azure-400 underline"
      >
        {{ t('subscription.videoEstimateTryTemplate') }}
      </a>
    </div>
  </Popover>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import { computed, ref } from 'vue'

import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { getComfyApiBaseUrl } from '@/config/comfyApi'
import { t } from '@/i18n'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { isCloud } from '@/platform/distribution/types'
import {
  FirebaseAuthStoreError,
  useFirebaseAuthStore
} from '@/stores/firebaseAuthStore'
import type { components } from '@/types/comfyRegistryTypes'

type SubscriptionTier = components['schemas']['SubscriptionTier']
type TierKey = 'standard' | 'creator' | 'pro'

interface PricingTierConfig {
  id: SubscriptionTier
  key: TierKey
  name: string
  price: string
  credits: string
  maxDuration: string
  customLoRAs: boolean
  videoEstimate: string
  isPopular?: boolean
}

const TIER_TO_KEY: Record<SubscriptionTier, TierKey> = {
  STANDARD: 'standard',
  CREATOR: 'creator',
  PRO: 'pro',
  FOUNDERS_EDITION: 'standard'
}

const tiers: PricingTierConfig[] = [
  {
    id: 'STANDARD',
    key: 'standard',
    name: t('subscription.tiers.standard.name'),
    price: t('subscription.tiers.standard.price'),
    credits: t('subscription.credits.standard'),
    maxDuration: t('subscription.maxDuration.standard'),
    customLoRAs: false,
    videoEstimate: t('subscription.tiers.standard.benefits.videoEstimate'),
    isPopular: false
  },
  {
    id: 'CREATOR',
    key: 'creator',
    name: t('subscription.tiers.creator.name'),
    price: t('subscription.tiers.creator.price'),
    credits: t('subscription.credits.creator'),
    maxDuration: t('subscription.maxDuration.creator'),
    customLoRAs: true,
    videoEstimate: t('subscription.tiers.creator.benefits.videoEstimate'),
    isPopular: true
  },
  {
    id: 'PRO',
    key: 'pro',
    name: t('subscription.tiers.pro.name'),
    price: t('subscription.tiers.pro.price'),
    credits: t('subscription.credits.pro'),
    maxDuration: t('subscription.maxDuration.pro'),
    customLoRAs: true,
    videoEstimate: t('subscription.tiers.pro.benefits.videoEstimate'),
    isPopular: false
  }
]

const { getAuthHeader } = useFirebaseAuthStore()
const { isActiveSubscription, subscriptionTier } = useSubscription()
const { accessBillingPortal, reportError } = useFirebaseAuthActions()
const { wrapWithErrorHandlingAsync } = useErrorHandling()

const isLoading = ref(false)
const loadingTier = ref<TierKey | null>(null)
const popover = ref()

const currentTierKey = computed<TierKey | null>(() =>
  subscriptionTier.value ? TIER_TO_KEY[subscriptionTier.value] : null
)

const isCurrentPlan = (tierKey: TierKey): boolean =>
  currentTierKey.value === tierKey

const togglePopover = (event: Event) => {
  popover.value.toggle(event)
}

const getButtonLabel = (tier: PricingTierConfig): string => {
  if (isCurrentPlan(tier.key)) return t('subscription.currentPlan')
  if (!isActiveSubscription.value)
    return t('subscription.subscribeTo', { plan: tier.name })
  return t('subscription.changeTo', { plan: tier.name })
}

const getButtonSeverity = (tier: PricingTierConfig): 'primary' | 'secondary' =>
  isCurrentPlan(tier.key)
    ? 'secondary'
    : tier.key === 'creator'
      ? 'primary'
      : 'secondary'

const getButtonTextClass = (tier: PricingTierConfig): string =>
  tier.key === 'creator'
    ? 'font-inter text-sm font-bold leading-normal text-white'
    : 'font-inter text-sm font-bold leading-normal text-primary-foreground'

const initiateCheckout = async (tierKey: TierKey) => {
  const authHeader = await getAuthHeader()
  if (!authHeader) {
    throw new FirebaseAuthStoreError(t('toastMessages.userNotAuthenticated'))
  }

  const response = await fetch(
    `${getComfyApiBaseUrl()}/customers/cloud-subscription-checkout/${tierKey}`,
    {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' }
    }
  )

  if (!response.ok) {
    let errorMessage = 'Failed to initiate checkout'
    try {
      const errorData = await response.json()
      errorMessage = errorData.message || errorMessage
    } catch {
      // If JSON parsing fails, try to get text response or use HTTP status
      try {
        const errorText = await response.text()
        errorMessage =
          errorText || `HTTP ${response.status} ${response.statusText}`
      } catch {
        errorMessage = `HTTP ${response.status} ${response.statusText}`
      }
    }

    throw new FirebaseAuthStoreError(
      t('toastMessages.failedToInitiateSubscription', {
        error: errorMessage
      })
    )
  }

  return await response.json()
}

const handleSubscribe = wrapWithErrorHandlingAsync(async (tierKey: TierKey) => {
  if (!isCloud || isLoading.value || isCurrentPlan(tierKey)) return

  isLoading.value = true
  loadingTier.value = tierKey

  try {
    if (isActiveSubscription.value) {
      await accessBillingPortal()
    } else {
      const response = await initiateCheckout(tierKey)
      if (response.checkout_url) {
        window.open(response.checkout_url, '_blank')
      }
    }
  } finally {
    isLoading.value = false
    loadingTier.value = null
  }
}, reportError)
</script>
