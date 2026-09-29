<script setup lang="ts">
import { computed, ref } from 'vue'

import type { SavedPaymentMethod } from '@comfyorg/account-core/billing'

import PaymentFormError from '@/components/fullPage/PaymentFormError.vue'
import SavedMethodSelect from '@/components/fullPage/SavedMethodSelect.vue'

/** The Saved tab: the list and its Pay, a row skeleton while it re-reads, or its own error. */
const {
  saved,
  methods,
  locked = false
} = defineProps<{
  saved: 'loading' | 'ready' | 'failed'
  methods: readonly SavedPaymentMethod[]
  /** Money is on its way: the list is inert, the pay slot is not. */
  locked?: boolean
}>()

const emit = defineEmits<{
  pay: [savedMethodId: string]
  retry: []
}>()

const pickedMethodId = ref<string | null>(null)

const chosenMethodId = computed(
  () =>
    methods.find((method) => method.id === pickedMethodId.value)?.id ??
    methods.find((method) => method.is_default)?.id ??
    methods[0]?.id
)

function pay() {
  if (chosenMethodId.value !== undefined) emit('pay', chosenMethodId.value)
}
</script>

<template>
  <PaymentFormError
    v-if="saved === 'failed'"
    rail="saved"
    @retry="emit('retry')"
  />
  <div
    v-else-if="saved === 'loading'"
    class="h-10 rounded-lg bg-secondary-background-hover"
  />
  <form v-else class="flex flex-col gap-6" @submit.prevent="pay">
    <div v-if="chosenMethodId !== undefined" :inert="locked">
      <SavedMethodSelect
        :methods
        :model-value="chosenMethodId"
        @update:model-value="pickedMethodId = $event"
      />
    </div>
    <slot name="pay" />
  </form>
</template>
