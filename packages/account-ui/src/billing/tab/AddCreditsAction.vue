<template>
  <div v-if="availability.kind !== 'hidden'">
    <CheckoutButton
      :variant
      :size
      :class="buttonClass"
      :disabled="availability.kind === 'disabled'"
      :aria-describedby="reason ? reasonId : undefined"
      @click="emit('click')"
    >
      <slot />
    </CheckoutButton>
    <p
      v-if="reason"
      :id="reasonId"
      :class="cn('m-0 text-muted-foreground', reasonClass)"
    >
      {{ reason }}
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * Add credits for a served availability; the reason arrives translated.
 */
import { useId } from 'vue'

import type { AddCreditsAvailability } from '@comfyorg/account-core/billing'
import type { ButtonVariants } from '@comfyorg/design-system/button.variants'
import { cn } from '@comfyorg/tailwind-utils'

import CheckoutButton from '#/billing/checkout/CheckoutButton.vue'

const { availability, reason = null } = defineProps<{
  availability: AddCreditsAvailability
  reason?: string | null
  variant?: ButtonVariants['variant']
  size?: ButtonVariants['size']
  buttonClass?: string
  reasonClass?: string
}>()

const emit = defineEmits<{ click: [] }>()

const reasonId = useId()
</script>
