<template>
  <Button
    v-tooltip.bottom="{
      value: buttonTooltip,
      showDelay: 600
    }"
    class="subscribe-to-run-button h-8 gap-1.5 rounded-lg px-4 whitespace-nowrap"
    variant="subscribe"
    size="unset"
    data-testid="subscribe-to-run-button"
    @click="handleSubscribeToRun"
  >
    <i class="pi pi-lock" />
    {{ buttonLabel }}
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

const buttonTooltip = computed(() =>
  canResubscribe.value
    ? t('subscription.subscribeToRunFull')
    : t('subscription.inactive.memberRunTooltip')
)

function handleSubscribeToRun() {
  if (isCloud) {
    trackRunButton({ subscribe_to_run: true })
  }

  showSubscriptionDialog({ reason: 'subscribe_to_run' })
}
</script>
