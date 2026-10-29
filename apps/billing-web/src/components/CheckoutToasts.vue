<template>
  <div
    class="fixed top-5 right-5 z-10 flex max-w-[calc(100vw-2.5rem)] flex-col gap-4"
  >
    <CheckoutToast
      v-for="toast in toasts"
      :key="toast.key"
      :variant="toast.variant"
      :severity="toast.severity"
      :summary="toast.summary"
      :detail="toast.detail"
      :close-label
      @close="emit('close', toast.key)"
    />
  </div>
</template>

<script setup lang="ts">
/** The toasts on screen, newest last, in the app's top-right column. */
import CheckoutToast from './CheckoutToast.vue'

export interface CheckoutToastItem {
  readonly key: string
  readonly severity: 'info' | 'warn' | 'error' | 'success'
  readonly summary: string
  readonly detail?: string
  readonly variant?: 'operation' | 'message'
}

const { toasts, closeLabel } = defineProps<{
  toasts: readonly CheckoutToastItem[]
  closeLabel: string
}>()

const emit = defineEmits<{
  close: [key: string]
}>()
</script>
