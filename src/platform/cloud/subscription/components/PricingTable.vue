<template>
  <div class="flex flex-col gap-8">
    <div class="flex justify-center">
      <SelectButton
        v-model="currentBillingCycle"
        :options="billingCycleOptions"
        option-label="label"
        option-value="value"
        :allow-empty="false"
        unstyled
        :pt="{
          root: {
            class: 'flex gap-1 bg-secondary-background rounded-lg p-1.5'
          },
          pcToggleButton: {
            root: ({ context }: ToggleButtonPassThroughMethodOptions) => ({
              class: [
                'w-36  h-8 rounded-md transition-colors cursor-pointer border-none outline-none ring-0 text-sm font-medium flex items-center justify-center',
                context.active
                  ? 'bg-base-foreground text-base-background'
                  : 'bg-transparent text-muted-foreground hover:bg-secondary-background-hover'
              ]
            }),
            label: { class: 'flex items-center gap-2 ' }
          }
        }"
      >
        <template #option="{ option }">
          <div class="flex items-center gap-2">
            <span>{{ option.label }}</span>
            <div
              v-if="option.value === 'yearly'"
              class="bg-primary-background text-white text-[11px] px-1 py-0.5 rounded-full flex items-center font-bold"
            >
              -20%
            </div>
          </div>
        </template>
      </SelectButton>
    </div>
    <div class="flex flex-col xl:flex-row items-stretch gap-6">
      <div
        v-for="tier in tiers"
        :key="tier.id"
        :class="
          cn(
            'flex-1 flex flex-col rounded-2xl border border-border-default bg-base-background shadow-[0_0_12px_rgba(0,0,0,0.1)]',
            tier.isPopular ? 'border-muted-foreground' : ''
          )
        "
      >
        <div class="p-8 pb-0 flex flex-col gap-8">
          <div class="flex flex-row items-center gap-2 justify-between">
            <span
              class="font-inter text-base font-bold leading-normal text-base-foreground"
            >
              {{ tier.name }}
            </span>
            <div
              v-if="tier.isPopular"
              class="rounded-full bg-base-foreground px-1.5 text-[11px] font-bold uppercase text-base-background h-5 tracking-tight flex items-center"
            >
              {{ t('subscription.mostPopular') }}
            </div>
          </div>
          <div class="flex flex-col">
            <div class="flex flex-col gap-2">
              <div class="flex flex-row items-baseline gap-2">
                <span
                  class="font-inter text-[32px] font-semibold leading-normal text-base-foreground"
                >
                  <span
                    v-show="currentBillingCycle === 'yearly'"
                    class="line-through text-2xl text-muted-foreground"
                  >
                    ${{ tier.price.monthly }}
                  </span>
                  ${{ getPrice(tier) }}
                </span>
                <span
                  class="font-inter text-xl leading-normal text-base-foreground"
                >
                  {{ t('subscription.usdPerMonth') }}
                </span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-sm text-muted-foreground">
                  {{
                    currentBillingCycle === 'yearly'
                      ? t('subscription.billedAnnually', {
                          total: tier.price.annualTotal
                        })
                      : t('subscription.billedMonthly')
                  }}
                </span>
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-4 pb-0 flex-1">
            <div class="flex flex-row items-center justify-between">
              <span
                class="font-inter text-sm font-normal leading-normal text-foreground"
              >
                {{
                  currentBillingCycle === 'yearly'
                    ? t('subscription.yearlyCreditsLabel')
                    : t('subscription.monthlyCreditsLabel')
                }}
              </span>
              <div class="flex flex-row items-center gap-1">
                <i class="icon-[lucide--component] text-amber-400 text-sm" />
                <span
                  class="font-inter text-sm font-bold leading-normal text-base-foreground"
                >
                  {{
                    (
                      tier.credits * (currentBillingCycle === 'yearly' ? 12 : 1)
                    ).toLocaleString()
                  }}
                </span>
              </div>
            </div>

            <div class="flex flex-row items-center justify-between">
              <span class="text-sm font-normal text-foreground">
                {{ t('subscription.maxDurationLabel') }}
              </span>
              <span
                class="font-inter text-sm font-bold leading-normal text-base-foreground"
              >
                {{ tier.maxDuration }}
              </span>
            </div>

            <div class="flex flex-row items-center justify-between">
              <span class="text-sm font-normal text-foreground">
                {{ t('subscription.gpuLabel') }}
              </span>
              <i class="pi pi-check text-xs text-success-foreground" />
            </div>

            <div class="flex flex-row items-center justify-between">
              <span class="text-sm font-normal text-foreground">
                {{ t('subscription.addCreditsLabel') }}
              </span>
              <i class="pi pi-check text-xs text-success-foreground" />
            </div>

            <div class="flex flex-row items-center justify-between">
              <span class="text-sm font-normal text-foreground">
                {{ t('subscription.customLoRAsLabel') }}
              </span>
              <i
                v-if="tier.customLoRAs"
                class="pi pi-check text-xs text-success-foreground"
              />
              <i v-else class="pi pi-times text-xs text-foreground" />
            </div>

            <div class="flex flex-col gap-2">
              <div class="flex flex-row items-start justify-between">
                <div class="flex flex-col gap-2">
                  <span class="text-sm font-normal text-foreground">
                    {{ t('subscription.videoEstimateLabel') }}
                  </span>
                  <div class="flex flex-row items-center gap-2 group pt-2">
                    <i
                      class="pi pi-question-circle text-xs text-muted-foreground group-hover:text-base-foreground"
                    />
                    <span
                      class="text-sm font-normal text-muted-foreground cursor-pointer group-hover:text-base-foreground"
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
        </div>
        <div class="flex flex-col p-8">
          <Button
            :label="getButtonLabel(tier)"
            :severity="getButtonSeverity(tier)"
            :disabled="isLoading || isCurrentPlan(tier.key)"
            :loading="loadingTier === tier.key"
            :class="
              cn(
                'h-10 w-full',
                tier.key === 'creator'
                  ? 'bg-base-foreground border-transparent hover:bg-inverted-background-hover'
                  : 'bg-secondary-background border-transparent hover:bg-secondary-background-hover focus:bg-secondary-background-selected'
              )
            "
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
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import SelectButton from 'primevue/selectbutton'
import type { ToggleButtonPassThroughMethodOptions } from 'primevue/togglebutton'
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
type CheckoutTier = TierKey | `${TierKey}-yearly`

type BillingCycle = 'monthly' | 'yearly'

const getCheckoutTier = (
  tierKey: TierKey,
  billingCycle: BillingCycle
): CheckoutTier => (billingCycle === 'yearly' ? `${tierKey}-yearly` : tierKey)

interface BillingCycleOption {
  label: string
  value: BillingCycle
}

interface PricingTierConfig {
  id: SubscriptionTier
  key: TierKey
  name: string
  price: Record<BillingCycle, string> & { annualTotal: string }
  credits: number
  maxDuration: string
  customLoRAs: boolean
  videoEstimate: string
  isPopular?: boolean
}

const billingCycleOptions: BillingCycleOption[] = [
  { label: t('subscription.yearly'), value: 'yearly' },
  { label: t('subscription.monthly'), value: 'monthly' }
]

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
    price: {
      monthly: t('subscription.tiers.standard.price.monthly'),
      yearly: t('subscription.tiers.standard.price.yearly'),
      annualTotal: t('subscription.tiers.standard.price.annualTotal')
    },
    credits: parseInt(t('subscription.credits.standard')),
    maxDuration: t('subscription.maxDuration.standard'),
    customLoRAs: false,
    videoEstimate: t('subscription.tiers.standard.benefits.videoEstimate'),
    isPopular: false
  },
  {
    id: 'CREATOR',
    key: 'creator',
    name: t('subscription.tiers.creator.name'),
    price: {
      monthly: t('subscription.tiers.creator.price.monthly'),
      yearly: t('subscription.tiers.creator.price.yearly'),
      annualTotal: t('subscription.tiers.creator.price.annualTotal')
    },
    credits: parseInt(t('subscription.credits.creator')),
    maxDuration: t('subscription.maxDuration.creator'),
    customLoRAs: true,
    videoEstimate: t('subscription.tiers.creator.benefits.videoEstimate'),
    isPopular: true
  },
  {
    id: 'PRO',
    key: 'pro',
    name: t('subscription.tiers.pro.name'),
    price: {
      monthly: t('subscription.tiers.pro.price.monthly'),
      yearly: t('subscription.tiers.pro.price.yearly'),
      annualTotal: t('subscription.tiers.pro.price.annualTotal')
    },
    credits: parseInt(t('subscription.credits.pro')),
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
const currentBillingCycle = ref<BillingCycle>('yearly')

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
    ? 'font-inter text-sm font-bold leading-normal text-base-background'
    : 'font-inter text-sm font-bold leading-normal text-primary-foreground'

const getPrice = (tier: PricingTierConfig): string =>
  tier.price[currentBillingCycle.value]

const initiateCheckout = async (tierKey: TierKey) => {
  const authHeader = await getAuthHeader()
  if (!authHeader) {
    throw new FirebaseAuthStoreError(t('toastMessages.userNotAuthenticated'))
  }

  const checkoutTier = getCheckoutTier(tierKey, currentBillingCycle.value)
  const response = await fetch(
    `${getComfyApiBaseUrl()}/customers/cloud-subscription-checkout/${checkoutTier}`,
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
