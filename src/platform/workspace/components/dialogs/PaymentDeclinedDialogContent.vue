<template>
  <div
    class="flex w-[min(440px,95vw)] flex-col overflow-hidden rounded-2xl border border-border-default bg-base-background shadow-[0_25px_80px_rgba(5,6,12,0.45)]"
  >
    <div
      class="flex h-14 items-center justify-between border-b border-border-default px-6"
    >
      <h2
        id="payment-declined"
        class="m-0 text-lg font-semibold text-base-foreground"
      >
        {{ $t('paymentDeclined.title') }}
      </h2>
      <button
        type="button"
        class="focus-visible:ring-secondary-foreground -m-1 cursor-pointer rounded-sm border-none bg-transparent p-1 text-muted-foreground transition-colors hover:text-base-foreground focus-visible:ring-1 focus-visible:outline-none"
        :aria-label="$t('g.close')"
        @click="$emit('close')"
      >
        <i class="icon-[lucide--x] size-5" />
      </button>
    </div>

    <div class="flex flex-col gap-5 px-6 pt-6">
      <p class="m-0 text-sm/5 text-muted-foreground">
        {{ $t('paymentDeclined.body') }}
      </p>
      <div class="flex flex-col gap-2 rounded-xl bg-secondary-background p-4">
        <span class="text-xs text-muted-foreground">
          {{ $t('paymentDeclined.reasonLabel') }}
        </span>
        <span class="text-sm font-medium text-base-foreground">
          {{ reason }}
        </span>
      </div>
    </div>

    <div class="flex flex-col gap-2 p-6">
      <Button
        variant="primary"
        size="lg"
        class="w-full"
        :loading="isOpeningPortal"
        @click="handleUpdatePaymentMethod"
      >
        {{ $t('paymentDeclined.updatePaymentMethod') }}
      </Button>
      <Button
        v-if="origin === 'subscription'"
        variant="muted-textonly"
        size="lg"
        class="w-full"
        @click="$emit('close')"
      >
        <i class="icon-[lucide--arrow-left] size-4" />
        {{ $t('subscription.preview.backToAllPlans') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'

const { origin, reason } = defineProps<{
  origin: 'subscription' | 'topup'
  reason: string
}>()

defineEmits<{
  close: []
}>()

const { t } = useI18n()
const toast = useToast()
const { manageSubscription } = useBillingContext()
const isOpeningPortal = ref(false)

async function handleUpdatePaymentMethod() {
  if (isOpeningPortal.value) return

  isOpeningPortal.value = true
  try {
    await manageSubscription()
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: t('paymentDeclined.portalError'),
      detail: error instanceof Error ? error.message : undefined
    })
  } finally {
    isOpeningPortal.value = false
  }
}
</script>
