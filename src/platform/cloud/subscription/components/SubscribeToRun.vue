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

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useRunButtonTelemetry } from '@/composables/useRunButtonTelemetry'
import { isCloud } from '@/platform/distribution/types'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

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
  if (!canResubscribe.value) return t('subscription.inactive.memberRunTooltip')
  // md+ already shows the full label, so the matching tooltip would be redundant
  return isMdOrLarger.value ? undefined : t('subscription.subscribeToRunFull')
})

function handleSubscribeToRun() {
  if (isCloud) {
    trackRunButton({ subscribe_to_run: true })
  }

  showSubscriptionDialog({ reason: 'subscribe_to_run' })
}
</script>
