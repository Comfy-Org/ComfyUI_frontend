<template>
  <div class="flex flex-col gap-2 pt-6">
    <span class="text-sm text-muted-foreground">
      {{ copy.savedPaymentMethod }}
    </span>
    <div
      v-if="methods.length === 1"
      class="flex h-10 items-center gap-3 rounded-lg bg-secondary-background px-4"
    >
      <i
        :class="
          cn(
            'size-4 shrink-0',
            methods[0].type === 'alipay'
              ? 'icon-[lucide--wallet]'
              : 'icon-[lucide--credit-card]'
          )
        "
      />
      <span class="text-sm text-base-foreground tabular-nums">
        {{ methodLabel(methods[0]) }}
      </span>
      <CheckoutButton
        variant="link"
        size="lg"
        class="ml-auto px-0"
        @click="emit('changePaymentMethod')"
      >
        {{ copy.changePaymentMethod }}
      </CheckoutButton>
    </div>
    <CheckoutSavedMethodSelect
      v-else
      v-model="selectedMethod"
      :label="copy.selectLabel"
      :options="options"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * The saved payment methods standing in for the card form. One method shows
 * a Change affordance; two or more become a picker whose last option adds a
 * new method. Cards carry brand + last4; Alipay is a linked account with
 * neither.
 */
import { computed } from 'vue'

import type { SavedPaymentMethod } from '@comfyorg/account-core/billing'
import { cn } from '@comfyorg/tailwind-utils'

import CheckoutButton from './CheckoutButton.vue'
import CheckoutSavedMethodSelect from './CheckoutSavedMethodSelect.vue'
import type { CheckoutSavedMethodCopy } from './checkoutCopy'

const ADD_NEW = 'add-new'

const { methods, copy } = defineProps<{
  methods: readonly SavedPaymentMethod[]
  copy: CheckoutSavedMethodCopy
}>()

const emit = defineEmits<{
  changePaymentMethod: []
}>()

const selectedMethodId = defineModel<string | null>('selectedMethodId', {
  default: null
})

function methodLabel(method: SavedPaymentMethod): string {
  if (method.type === 'alipay') return copy.alipay
  return `${method.brand} •••• ${method.last4}`
}

const options = computed(() => [
  ...methods.map((method) => ({
    name: methodLabel(method),
    value: method.id
  })),
  { name: copy.addNewPaymentMethod, value: ADD_NEW }
])

const selectedMethod = computed({
  get: () => selectedMethodId.value ?? '',
  set: (value: string) => {
    if (value === ADD_NEW) {
      selectedMethodId.value = null
      emit('changePaymentMethod')
      return
    }
    selectedMethodId.value = value
  }
})
</script>
