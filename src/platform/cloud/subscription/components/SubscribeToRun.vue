<template>
  <Button
    v-tooltip.bottom="{
      value: buttonTooltip,
      showDelay: 600
    }"
    :class="
      cn(
        'subscribe-to-run-button gap-1.5 rounded-lg px-4 whitespace-nowrap [--credits-pill-base:var(--color-brand-yellow)]',
        large ? 'h-10 text-sm' : 'h-8'
      )
    "
    variant="brand-yellow"
    size="unset"
    data-testid="subscribe-to-run-button"
    @click="handleSubscribeToRun"
  >
    <i class="pi pi-lock" />
    {{ buttonLabel }}
    <slot name="trailing" />
  </Button>
</template>

<script setup lang="ts">
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useRunButtonTelemetry } from '@/composables/useRunButtonTelemetry'
import { isCloud } from '@/platform/distribution/types'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { cn } from '@comfyorg/tailwind-utils'

const { large = false } = defineProps<{ large?: boolean }>()

const { t } = useI18n()

const breakpoints = useBreakpoints(breakpointsTailwind)
const isMdOrLarger = breakpoints.greaterOrEqual('md')

const { permissions } = useWorkspaceUI()
const { showSubscriptionDialog } = useBillingContext()
const { trackRunButton } = useRunButtonTelemetry()

const canResubscribe = computed(() => permissions.value.canManageSubscription)

const buttonLabel = computed(() => {
  if (!canResubscribe.value) return t('subscription.inactive.runLabel')
  return isMdOrLarger.value
    ? t('subscription.subscribeToRunFull')
    : t('subscription.subscribeToRun')
})

const buttonTooltip = computed(() => {
  const tooltip = canResubscribe.value
    ? t('subscription.subscribeToRunFull')
    : t('subscription.inactive.memberRunTooltip')
  // Skip the tooltip when it would only repeat the visible button label
  return tooltip === buttonLabel.value ? undefined : tooltip
})

function handleSubscribeToRun() {
  if (isCloud) {
    trackRunButton({ subscribe_to_run: true })
  }

  showSubscriptionDialog()
}
</script>
