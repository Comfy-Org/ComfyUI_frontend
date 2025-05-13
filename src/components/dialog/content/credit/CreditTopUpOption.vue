<template>
  <div class="flex items-center gap-2">
    <Tag
      severity="secondary"
      icon="pi pi-dollar"
      rounded
      class="text-amber-400 p-1"
    />
    <InputNumber
      v-if="editable"
      v-model="customAmount"
      :min="1"
      :max="1000"
      :step="1"
      show-buttons
      :allow-empty="false"
      :highlight-on-focus="true"
      pt:pc-input-text:root="w-24"
      @blur="(e: InputNumberBlurEvent) => (customAmount = Number(e.value))"
      @input="(e: InputNumberInputEvent) => (customAmount = Number(e.value))"
    />
    <span v-else class="text-xl">{{ amount }}</span>
  </div>
  <ProgressSpinner v-if="loading" class="w-8 h-8" />
  <Button
    v-else
    :severity="preselected ? 'primary' : 'secondary'"
    :outlined="!preselected"
    :label="$t('credits.topUp.buyNow')"
    @click="handleBuyNow"
  />
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import InputNumber, {
  type InputNumberBlurEvent,
  type InputNumberInputEvent
} from 'primevue/inputnumber'
import ProgressSpinner from 'primevue/progressspinner'
import Tag from 'primevue/tag'
import { onBeforeUnmount, ref } from 'vue'

import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'

const authActions = useFirebaseAuthActions()

const {
  amount,
  preselected,
  editable = false
} = defineProps<{
  amount: number
  preselected: boolean
  editable?: boolean
}>()

const customAmount = ref(amount)
const didClickBuyNow = ref(false)
const loading = ref(false)

const handleBuyNow = async () => {
  loading.value = true
  await authActions.purchaseCredits(editable ? customAmount.value : amount)
  loading.value = false
  didClickBuyNow.value = true
}

onBeforeUnmount(() => {
  if (didClickBuyNow.value) {
    // If clicked buy now, then returned back to the dialog and closed, fetch the balance
    void authActions.fetchBalance()
  }
})
</script>
