<template>
  <div class="subscription-container h-full">
    <div class="flex h-full flex-col gap-6">
      <div class="flex items-center gap-2">
        <span class="font-inter text-2xl/tight font-semibold">
          {{
            isActiveSubscription
              ? $t('subscription.title')
              : $t('subscription.titleUnsubscribed')
          }}
        </span>
        <div class="pt-1">
          <CloudBadge
            reverse-order
            background-color="var(--p-dialog-background)"
          />
        </div>
      </div>

      <!-- Workspace mode: workspace-aware subscription content (renders its own footer) -->
      <SubscriptionPanelContentWorkspace v-if="shouldUseWorkspaceBilling" />
      <!-- Legacy mode: user-level subscription content -->
      <template v-else>
        <SubscriptionPanelContentLegacy />
        <SubscriptionFooterLinks />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

import CloudBadge from '@/components/topbar/CloudBadge.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useBillingRouting } from '@/composables/billing/useBillingRouting'
import SubscriptionFooterLinks from '@/platform/cloud/subscription/components/SubscriptionFooterLinks.vue'
import SubscriptionPanelContentLegacy from '@/platform/cloud/subscription/components/SubscriptionPanelContentLegacy.vue'

const SubscriptionPanelContentWorkspace = defineAsyncComponent(
  () =>
    import('@/platform/workspace/components/SubscriptionPanelContentWorkspace.vue')
)

const { shouldUseWorkspaceBilling } = useBillingRouting()

const { isActiveSubscription } = useBillingContext()
</script>
