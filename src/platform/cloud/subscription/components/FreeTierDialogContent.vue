<template>
  <div class="relative grid h-full grid-cols-5">
    <!-- Custom close button -->
    <Button
      size="icon"
      variant="muted-textonly"
      class="absolute top-2.5 right-2.5 z-10 size-8 rounded-full p-0 text-white hover:bg-white/20"
      :aria-label="$t('g.close')"
      @click="$emit('close', false)"
    >
      <i class="pi pi-times" />
    </Button>

    <div
      class="relative col-span-2 flex items-center justify-center overflow-hidden rounded-sm"
    >
      <video
        autoplay
        loop
        muted
        playsinline
        class="h-full min-w-[125%] object-cover p-0"
        style="margin-left: -20%"
      >
        <source
          src="/assets/images/cloud-subscription.webm"
          type="video/webm"
        />
      </video>
    </div>

    <div class="col-span-3 flex flex-col justify-between p-8">
      <div>
        <div class="flex flex-col gap-6">
          <div class="text-sm text-text-primary">
            <template v-if="reason === 'out_of_credits'">
              {{ $t('subscription.freeTier.outOfCredits.title') }}
            </template>
            <template v-else-if="reason === 'top_up_blocked'">
              {{ $t('subscription.freeTier.topUpBlocked.title') }}
            </template>
            <template v-else>
              {{ $t('subscription.freeTier.title') }}
            </template>
          </div>

          <p
            v-if="reason === 'out_of_credits'"
            class="m-0 text-sm text-text-secondary"
          >
            {{ $t('subscription.freeTier.outOfCredits.subtitle') }}
          </p>

          <p
            v-if="!isCreditsBlockedVariant"
            class="m-0 text-sm text-text-secondary"
          >
            {{
              quotaEnabled
                ? $t('subscription.freeTier.descriptionQuota', {
                    runs: maxAvailable
                  })
                : freeTierCredits
                  ? $t('subscription.freeTier.description', {
                      credits: freeTierCredits.toLocaleString()
                    })
                  : $t('subscription.freeTier.descriptionGeneric')
            }}
          </p>

          <p
            v-if="
              !isCreditsBlockedVariant && !quotaEnabled && formattedRenewalDate
            "
            class="m-0 text-sm text-text-secondary"
          >
            {{
              $t('subscription.freeTier.nextRefresh', {
                date: formattedRenewalDate
              })
            }}
          </p>
        </div>

        <SubscriptionBenefits is-free-tier class="mt-6 text-muted" />
      </div>

      <div class="flex flex-col pt-8">
        <Button
          class="w-full rounded-lg bg-(--color-accent-blue,#0B8CE9) px-4 py-2 font-inter text-sm font-bold text-white hover:bg-(--color-accent-blue,#0B8CE9)/90"
          @click="$emit('upgrade')"
        >
          {{
            isCreditsBlockedVariant
              ? $t('subscription.freeTier.upgradeCta')
              : $t('subscription.freeTier.subscribeCta')
          }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import type { PaymentIntentSource } from '@/platform/telemetry/types'
import SubscriptionBenefits from '@/platform/cloud/subscription/components/SubscriptionBenefits.vue'
import { useFreeTierQuota } from '@/platform/cloud/subscription/composables/useFreeTierQuota'
import { getTierCredits } from '@/platform/cloud/subscription/constants/tierPricing'

const { reason } = defineProps<{
  reason?: PaymentIntentSource
}>()

defineEmits<{
  close: [subscribed: boolean]
  upgrade: []
}>()

const { renewalDate } = useBillingContext()
const { quotaEnabled, maxAvailable } = useFreeTierQuota()

const formattedRenewalDate = computed(() => {
  if (!renewalDate.value) return ''

  return new Date(renewalDate.value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
})

const freeTierCredits = computed(() => getTierCredits('free'))

// Only these two variants replace the generic free-tier copy; any other
// intent reason (subscribe_to_run, deep_link, ...) keeps the default pitch.
const isCreditsBlockedVariant = computed(
  () => reason === 'out_of_credits' || reason === 'top_up_blocked'
)
</script>
