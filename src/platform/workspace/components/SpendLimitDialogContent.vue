<template>
  <div
    class="flex min-w-[460px] flex-col rounded-2xl border border-border-default bg-base-background shadow-[1px_1px_8px_0_rgba(0,0,0,0.4)]"
  >
    <!-- Header -->
    <div class="flex items-center justify-between p-8">
      <h2 class="m-0 text-lg font-bold text-base-foreground">
        <Skeleton v-if="ctaLoading" class="h-7 w-48" />
        <template v-else>{{ title }}</template>
      </h2>
      <button
        class="focus-visible:ring-secondary-foreground cursor-pointer rounded-sm border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-base-foreground focus-visible:ring-1 focus-visible:outline-none"
        :aria-label="$t('g.close')"
        @click="handleClose"
      >
        <i class="icon-[lucide--x] size-6" />
      </button>
    </div>

    <!-- Capability error fallback -->
    <p
      v-if="capabilityError"
      aria-live="polite"
      data-testid="capability-error-fallback"
      class="m-0 px-8 text-sm text-muted-foreground"
    >
      {{ $t('billing.spendLimit.capabilityError') }}
    </p>

    <!-- one_time_only info box -->
    <div
      v-else-if="capability === 'one_time_only'"
      class="mx-8 flex items-start gap-2 rounded-lg bg-secondary-background p-3 text-sm"
    >
      <i
        class="mt-0.5 icon-[lucide--info] size-4 shrink-0 text-base-foreground"
      />
      <span class="text-base-foreground">{{
        $t('billing.spendLimit.oneTimeOnlyInfo', { method: methodLabel })
      }}</span>
    </div>

    <!-- Actions -->
    <div class="flex flex-col gap-4 p-8">
      <Button
        :disabled="ctaLoading"
        :loading="ctaLoading"
        variant="primary"
        size="lg"
        class="h-10 justify-center"
        :aria-label="ctaAriaLabel"
        @click="handleMainCta"
      >
        <Skeleton v-if="ctaLoading" class="h-4 w-32" />
        <template v-else>{{ ctaLabel }}</template>
      </Button>

      <button
        class="cursor-pointer border-none bg-transparent text-sm text-muted-foreground transition-colors hover:text-base-foreground"
        @click="handleBuyManually"
      >
        {{ $t('billing.spendLimit.orBuyManually') }}
      </button>
    </div>

    <!-- TODO: paused/dunning account states (day-7/day-21) -->
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

type Scenario = 'limit_reached' | 'payment_failed'
type Capability = 'none' | 'one_time_only' | 'reusable'

const {
  scenario,
  capability,
  methodType,
  capabilityError = false
} = defineProps<{
  scenario: Scenario
  capability: Capability
  methodType?: string
  capabilityError?: boolean
}>()

const { t } = useI18n()
const dialogStore = useDialogStore()
const dialogService = useDialogService()
const toastStore = useToastStore()
const { manageSubscription } = useBillingContext()

const ctaLoading = ref(false)

const METHOD_LABELS: Record<string, string> = {
  alipay: 'Alipay',
  card: 'Your card',
  us_bank_account: 'Your bank account',
  link: 'Link'
}

const methodLabel = computed(() => {
  if (!methodType) return t('billing.spendLimit.defaultMethod')
  return METHOD_LABELS[methodType] ?? 'Your current payment method'
})

const title = computed(() => {
  if (
    capabilityError ||
    capability === 'none' ||
    capability === 'one_time_only'
  ) {
    return t('billing.spendLimit.addPaymentMethodTitle')
  }
  return t('billing.spendLimit.paymentFailedTitle')
})

const ctaLabel = computed(() => {
  if (
    capabilityError ||
    capability === 'none' ||
    capability === 'one_time_only'
  ) {
    return t('billing.spendLimit.addPaymentMethodCta')
  }
  return t('billing.spendLimit.updatePaymentMethodCta')
})

const ctaAriaLabel = computed(() => {
  if (capability === 'reusable' && scenario === 'payment_failed') {
    return t('billing.spendLimit.updatePaymentMethodCta')
  }
  return t('billing.spendLimit.addPaymentMethodCta')
})

function handleClose() {
  dialogStore.closeDialog({ key: 'spend-limit' })
}

async function handleMainCta() {
  if (ctaLoading.value) return
  ctaLoading.value = true
  try {
    if (capability === 'reusable' && scenario === 'payment_failed') {
      await manageSubscription()
    } else {
      const response = await workspaceApi.initiateAddPaymentMethod()
      const paymentWindow = window.open(response.payment_method_url, '_blank')
      if (!paymentWindow) {
        toastStore.add({
          severity: 'warn',
          summary: t('g.warning'),
          detail: t('subscription.preview.paymentPopupBlocked')
        })
      }
    }
  } catch (err) {
    toastStore.add({
      severity: 'error',
      summary: t('g.error'),
      detail: err instanceof Error ? err.message : t('g.unknownError')
    })
  } finally {
    ctaLoading.value = false
  }
}

async function handleBuyManually() {
  handleClose()
  await dialogService.showTopUpCreditsDialog()
}
</script>
