<template>
  <div class="grid h-full grid-cols-5 px-10 pb-10">
    <div
      class="relative col-span-2 flex items-center justify-center overflow-hidden rounded-sm"
    >
      <video
        autoplay
        loop
        muted
        playsinline
        class="h-full min-w-[125%] object-cover"
        style="margin-left: -20%"
      >
        <source
          src="/assets/images/cloud-subscription.webm"
          type="video/webm"
        />
      </video>
    </div>

    <div class="col-span-3 flex flex-col justify-between pl-8">
      <div>
        <div class="flex flex-col gap-4">
          <div class="inline-flex items-center gap-2">
            <div class="text-sm text-muted">
              {{ $t('subscription.required.title') }}
            </div>
            <CloudBadge
              reverse-order
              no-padding
              background-color="var(--p-dialog-background)"
            />
          </div>

          <div class="flex items-baseline gap-2">
            <span class="text-4xl font-bold">{{ formattedMonthlyPrice }}</span>
            <span class="text-xl">{{ $t('subscription.perMonth') }}</span>
          </div>
        </div>

        <SubscriptionBenefits class="mt-6 text-muted" />
      </div>

      <div class="flex flex-col">
        <SubscribeButton @subscribed="handleSubscribed" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import CloudBadge from '@/components/topbar/CloudBadge.vue'
import SubscribeButton from '@/platform/cloud/subscription/components/SubscribeButton.vue'
import SubscriptionBenefits from '@/platform/cloud/subscription/components/SubscriptionBenefits.vue'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'

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
