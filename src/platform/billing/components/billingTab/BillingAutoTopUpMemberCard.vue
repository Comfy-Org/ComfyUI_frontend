<template>
  <div
    v-if="manageAutoTopUpDenial === 'not_workspace_owner'"
    class="flex flex-col gap-1 rounded-xl border border-card px-5 py-4"
    data-testid="billing-auto-top-up-member-card"
  >
    <h3 class="m-0 text-sm font-medium text-foreground">
      {{ $t('workspacePanel.billingTab.autoTopUp.title') }}
    </h3>
    <p class="m-0 text-sm text-muted-foreground">
      {{ $t('workspacePanel.billingTab.autoTopUp.member') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'

const { manageAutoTopUpDenial } = useBillingCapabilities()
</script>
