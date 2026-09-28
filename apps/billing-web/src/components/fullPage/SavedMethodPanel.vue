<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SavedPaymentMethod } from '@comfyorg/account-core/billing'
import type { CheckoutSavedMethodCopy } from '@comfyorg/account-ui/billing/checkout'
import { CheckoutSavedMethods } from '@comfyorg/account-ui/billing/checkout'

import PaymentFormError from '@/components/fullPage/PaymentFormError.vue'

/** The Saved tab: the list and its Pay, a row skeleton while it re-reads, or its own error. */
const { saved, methods } = defineProps<{
  saved: 'loading' | 'ready' | 'failed'
  methods: readonly SavedPaymentMethod[]
}>()

const emit = defineEmits<{
  pay: [savedMethodId: string]
  retry: []
  addNew: []
}>()

const { t } = useI18n()

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

const copy = computed<CheckoutSavedMethodCopy>(() => ({
  savedPaymentMethod: t('checkout.fullPage.saved.label'),
  changePaymentMethod: t('checkout.fullPage.saved.change'),
  addNewPaymentMethod: t('checkout.fullPage.saved.addNew'),
  alipay: t('checkout.fullPage.saved.alipay'),
  selectLabel: t('checkout.fullPage.saved.selectLabel')
}))
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
    <CheckoutSavedMethods
      :methods
      :copy
      :selected-method-id="chosenMethodId ?? null"
      @update:selected-method-id="pickedMethodId = $event"
      @change-payment-method="emit('addNew')"
    />
    <slot name="pay" />
  </form>
</template>
