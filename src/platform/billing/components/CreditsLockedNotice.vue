<template>
  <p
    role="status"
    data-testid="credits-locked-notice"
    class="m-0 text-sm text-muted-foreground"
  >
    {{
      subscriptionState === 'ended'
        ? $t('credits.topUp.planRequiredResubscribe')
        : $t('credits.topUp.planRequiredSubscribe')
    }}
  </p>
</template>

<script setup lang="ts">
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'

const { subscriptionState } = useBillingContext()
</script>
