<template>
  <div
    :class="
      cn(
        'relative flex w-lg flex-col overflow-hidden rounded-2xl bg-secondary-background ring-1 ring-border-default ring-inset',
        origin === 'subscription' ? 'h-[786px]' : 'h-[460px]'
      )
    "
  >
    <Button
      variant="muted-textonly"
      size="icon"
      class="absolute top-2 right-2 z-10 rounded-full"
      :aria-label="$t('g.close')"
      @click="$emit('close')"
    >
      <i class="icon-[lucide--x] size-4" />
    </Button>

    <div
      :class="
        cn(
          'absolute top-6 left-16 flex w-96 flex-col items-center',
          origin === 'subscription' ? 'h-[730px]' : 'h-[395px]'
        )
      "
    >
      <i
        class="mt-8 icon-[lucide--circle-alert] size-12 shrink-0 text-warning-background"
      />
      <h2
        id="payment-declined"
        class="m-0 mt-4 text-center text-2xl/6 font-semibold text-base-foreground"
      >
        {{ $t('paymentDeclined.title') }}
      </h2>
      <p class="m-0 mt-2 text-center text-sm/5 text-muted-foreground">
        {{ $t('paymentDeclined.body') }}
      </p>
      <div
        class="mt-[45px] flex min-h-[94px] w-full shrink-0 flex-col gap-2 rounded-lg bg-tertiary-background p-6"
      >
        <span class="text-base/4 text-muted-foreground">
          {{ $t('paymentDeclined.reasonLabel') }}
        </span>
        <span
          class="max-h-12 overflow-y-auto text-base/4 wrap-break-word text-base-foreground"
        >
          {{ reason }}
        </span>
      </div>

      <div class="mt-auto flex w-full flex-col gap-4">
        <Button
          variant="tertiary"
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
          size="sm"
          class="w-full text-sm"
          @click="$emit('close')"
        >
          <i class="icon-[lucide--arrow-left] size-4" />
          {{ $t('subscription.preview.backToAllPlans') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useToast } from 'primevue/usetoast'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'

const { origin, reason } = defineProps<{
  origin: 'subscription' | 'topup'
  reason: string
}>()

const emit = defineEmits<{
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
    emit('close')
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
