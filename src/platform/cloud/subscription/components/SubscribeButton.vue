<template>
  <Button
    :size
    :disabled="disabled"
    :variant="buttonVariant === 'subscribe' ? 'subscribe' : 'primary'"
    :class="cn('font-bold', fluid && 'w-full')"
    @click="handleSubscribe"
  >
    {{ label || $t('subscription.required.subscribe') }}
  </Button>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import { cn } from '@comfyorg/tailwind-utils'

const {
  size = 'lg',
  fluid = true,
  buttonVariant = 'default',
  label,
  disabled = false
} = defineProps<{
  label?: string
  size?: 'sm' | 'lg'
  buttonVariant?: 'default' | 'subscribe'
  fluid?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  subscribed: []
}>()

const { canAccessSubscriptionFeatures, showSubscriptionDialog, tier } =
  useBillingContext()
const isAwaitingStripeSubscription = ref(false)

watch(
  [isAwaitingStripeSubscription, canAccessSubscriptionFeatures],
  ([awaiting, isActive]) => {
    if (isCloud && awaiting && isActive) {
      emit('subscribed')
      isAwaitingStripeSubscription.value = false
    }
  }
)

const handleSubscribe = () => {
  useTelemetry()?.trackSubscription('subscribe_clicked', {
    current_tier: tier.value?.toLowerCase()
  })
  isAwaitingStripeSubscription.value = true
  showSubscriptionDialog({ reason: 'subscribe_now_button' })
}

onBeforeUnmount(() => {
  isAwaitingStripeSubscription.value = false
})
</script>
