<template>
  <div class="relative grid h-full grid-cols-5">
    <!-- Custom close button -->
    <Button
      size="icon"
      variant="muted-textonly"
      class="rounded-full absolute top-2.5 right-2.5 z-10 h-8 w-8 p-0 text-white hover:bg-white/20"
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
          <div class="inline-flex items-center gap-2">
            <div class="text-sm text-text-primary">
              {{
                reason === 'out_of_credits'
                  ? $t('subscription.freeTier.topUpBlocked.title')
                  : $t('subscription.freeTier.title')
              }}
            </div>
            <CloudBadge
              reverse-order
              no-padding
              background-color="var(--p-dialog-background)"
              use-subscription
            />
          </div>

          <p class="m-0 text-sm text-text-secondary">
            {{
              reason === 'out_of_credits'
                ? $t('subscription.freeTier.topUpBlocked.description')
                : $t('subscription.freeTier.description', {
                    credits: formattedCredits
                  })
            }}
          </p>

          <p
            v-if="reason !== 'out_of_credits' && formattedRenewalDate"
            class="m-0 text-sm text-text-secondary"
          >
            {{
              $t('subscription.freeTier.nextRefresh', {
                date: formattedRenewalDate
              })
            }}
          </p>
        </div>

        <SubscriptionBenefits class="mt-6 text-muted" />
      </div>

      <div class="flex flex-col pt-8">
        <Button
          variant="primary"
          class="py-2 px-4 rounded-lg w-full"
          :pt="{
            root: {
              style: 'background: var(--color-accent-blue, #0B8CE9);'
            },
            label: {
              class: 'font-inter font-[700] text-sm'
            }
          }"
          @click="$emit('upgrade')"
        >
          {{
            reason === 'out_of_credits'
              ? $t('subscription.freeTier.topUpBlocked.subscribeCta')
              : $t('subscription.freeTier.subscribeCta')
          }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import CloudBadge from '@/components/topbar/CloudBadge.vue'
import Button from '@/components/ui/button/Button.vue'
import SubscriptionBenefits from '@/platform/cloud/subscription/components/SubscriptionBenefits.vue'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { centsToCredits } from '@/base/credits/comfyCredits'

defineProps<{
  reason?: 'subscription_required' | 'out_of_credits'
}>()

defineEmits<{
  close: [subscribed: boolean]
  upgrade: []
}>()

const { formattedRenewalDate } = useSubscription()

const FREE_TIER_CENTS = 190
const formattedCredits = Math.round(
  centsToCredits(FREE_TIER_CENTS)
).toLocaleString()
</script>

<style scoped>
:deep(.bg-comfy-menu-secondary) {
  background-color: transparent;
}

:deep(.p-button) {
  color: white;
}
</style>
