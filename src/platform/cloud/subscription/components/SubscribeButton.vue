<template>
  <Button
    :label="label || $t('subscription.required.subscribe')"
    :size="size"
    severity="primary"
    :style="
      variant === 'gradient'
        ? {
            background: 'var(--color-subscription-button-gradient)',
            color: 'var(--color-white)'
          }
        : undefined
    "
    :pt="{
      root: {
        class: rootClass
      }
    }"
    @click="handleSubscribe"
  />
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import { cn } from '@/utils/tailwindUtil'

const props = withDefaults(
  defineProps<{
    label?: string
    size?: 'small' | 'large'
    variant?: 'default' | 'gradient'
    fluid?: boolean
  }>(),
  {
    size: 'large',
    variant: 'default',
    fluid: true
  }
)

const rootClass = computed(() => cn('font-bold', props.fluid && 'w-full'))

const emit = defineEmits<{
  subscribed: []
}>()

const { isActiveSubscription, showSubscriptionDialog } = useSubscription()

const isAwaitingStripeSubscription = ref(false)

watch(
  [isAwaitingStripeSubscription, isActiveSubscription],
  ([awaiting, isActive]) => {
    if (isCloud && awaiting && isActive) {
      emit('subscribed')
      isAwaitingStripeSubscription.value = false
    }
  }
)

const handleSubscribe = () => {
  if (isCloud) {
    useTelemetry()?.trackSubscription('subscribe_clicked')
    isAwaitingStripeSubscription.value = true
    showSubscriptionDialog()
  }
}

onBeforeUnmount(() => {
  isAwaitingStripeSubscription.value = false
})
</script>
