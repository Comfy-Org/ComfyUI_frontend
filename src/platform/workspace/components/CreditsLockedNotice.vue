<template>
  <p
    role="status"
    data-testid="credits-locked-notice"
    class="m-0 text-sm text-muted-foreground"
  >
    {{
      subscriptionStatus === 'ended'
        ? $t('credits.topUp.planRequiredResubscribe')
        : $t('credits.topUp.planRequiredSubscribe')
    }}
  </p>
</template>

<script setup lang="ts">
import { useBillingContext } from '@/composables/billing/useBillingContext'

const { subscriptionStatus } = useBillingContext()
</script>
