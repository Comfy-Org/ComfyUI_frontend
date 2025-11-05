<template>
  <div class="relative grid h-full grid-cols-5">
    <!-- Custom close button -->
    <Button
      icon="pi pi-times"
      text
      rounded
      class="absolute top-2.5 right-2.5 z-10 h-8 w-8 p-0 text-white hover:bg-white/20"
      :aria-label="$t('g.close')"
      @click="onClose"
    />

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
            <div class="text-sm text-muted text-text-primary">
              {{ $t('subscription.required.title') }}
            </div>
            <CloudBadge
              reverse-order
              no-padding
              background-color="var(--p-dialog-background)"
              use-subscription
            />
          </div>

          <div class="flex items-baseline gap-2">
            <span class="text-4xl font-bold">{{ formattedMonthlyPrice }}</span>
            <span class="text-xl">{{ $t('subscription.perMonth') }}</span>
          </div>
        </div>

        <SubscriptionBenefits class="mt-6 text-muted" />
      </div>

      <div class="flex flex-col pt-8">
        <SubscribeButton
          class="py-2 px-4 rounded-lg"
          :pt="{
            root: {
              style: 'background: var(--color-accent-blue, #0B8CE9);'
            },
            label: {
              class: 'font-inter font-[700] text-sm'
            }
          }"
          @subscribed="handleSubscribed"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'

import CloudBadge from '@/components/topbar/CloudBadge.vue'
import SubscribeButton from '@/platform/cloud/subscription/components/SubscribeButton.vue'
import SubscriptionBenefits from '@/platform/cloud/subscription/components/SubscriptionBenefits.vue'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'

defineProps<{
  onClose: () => void
}>()

const emit = defineEmits<{
  close: [subscribed: boolean]
}>()

const { formattedMonthlyPrice } = useSubscription()

const handleSubscribed = () => {
  emit('close', true)
}
</script>

<style scoped>
:deep(.bg-comfy-menu-secondary) {
  background-color: transparent;
}

:deep(.p-button) {
  color: white;
}
</style>
