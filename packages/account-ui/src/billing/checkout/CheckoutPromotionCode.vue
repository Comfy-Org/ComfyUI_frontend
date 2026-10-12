<template>
  <div class="flex gap-2 pt-6">
    <input
      v-model="code"
      :aria-label="copy.promoCodePlaceholder"
      :disabled
      class="h-10 min-w-0 flex-1 rounded-lg border border-interface-stroke bg-secondary-background px-3 text-base-foreground"
      :placeholder="copy.promoCodePlaceholder"
      @input="invalidateEditedCode"
    />
    <CheckoutButton
      variant="secondary"
      size="lg"
      :disabled
      @click="emit('apply', code)"
    >
      {{ copy.applyPromoCode }}
    </CheckoutButton>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import CheckoutButton from './CheckoutButton.vue'
import type { CheckoutCopy } from './checkoutCopy'

const {
  appliedCode,
  disabled = false,
  copy
} = defineProps<{
  /** The code the current quote was priced with. */
  appliedCode: string | undefined
  disabled?: boolean
  copy: Pick<CheckoutCopy, 'promoCodePlaceholder' | 'applyPromoCode'>
}>()

const emit = defineEmits<{
  apply: [code: string]
  /** The typed code no longer matches the quote, so the quote is stale. */
  invalidate: []
}>()

const code = ref(appliedCode ?? '')
watch(
  () => appliedCode,
  (applied) => {
    code.value = applied ?? ''
  }
)

function invalidateEditedCode() {
  if (code.value !== (appliedCode ?? '')) emit('invalidate')
}
</script>
