<template>
  <div class="flex flex-col gap-6" data-testid="billing-tab">
    <div
      v-if="load === 'loading'"
      class="flex flex-col gap-2"
      data-testid="billing-plan-skeleton"
      aria-busy="true"
    >
      <Skeleton class="h-6 w-1/3" />
      <Skeleton class="h-4 w-2/3" />
    </div>
    <div
      v-else-if="load === 'error'"
      class="flex items-center justify-between gap-4"
      role="alert"
      data-testid="billing-load-error"
    >
      <p class="m-0 text-sm text-muted-foreground">
        {{ $t('workspacePanel.billingTab.loadError') }}
      </p>
      <Button variant="secondary" class="shrink-0" @click="retry">
        {{ $t('workspacePanel.billingTab.tryAgain') }}
      </Button>
    </div>
    <BillingPlanRow
      v-else
      :state="planRow"
      :action="action"
      :can-manage-billing="canManageBilling"
    />

    <section
      class="flex items-center justify-between gap-4"
      data-testid="billing-handoff"
    >
      <span class="text-sm wrap-break-word text-muted-foreground">
        {{ $t(`workspacePanel.billingTab.handoff.${handoffAudience}.label`) }}
      </span>
      <Button
        as="a"
        :href="handoffUrl"
        target="_blank"
        rel="noopener"
        variant="secondary"
        class="shrink-0"
      >
        {{ $t(`workspacePanel.billingTab.handoff.${handoffAudience}.action`) }}
        <i class="icon-[lucide--external-link] size-4" aria-hidden="true" />
      </Button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { pendingServerFact } from '@/platform/serverFacts/pendingServerFact'
import BillingPlanRow from '@/platform/workspace/components/dialogs/settings/billing/BillingPlanRow.vue'
import {
  deriveBillingTabLoad,
  planRowAction
} from '@/platform/workspace/components/dialogs/settings/billing/planRow'
import { useBillingPlanRow } from '@/platform/workspace/components/dialogs/settings/billing/useBillingPlanRow'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { platformLink } from '@/platform/workspace/utils/platformLink'

const billing = useBillingContext()
const capabilities = useBillingCapabilities()
const { workspaceRole } = useWorkspaceUI()
const { state: planRow } = useBillingPlanRow()

const HANDOFF_PATH = {
  owner: '/profile/billing',
  member: '/profile/usage'
} as const

const canManageBilling = computed(() =>
  pendingServerFact('BE-20308', workspaceRole.value === 'owner')
)

const handoffAudience = computed(() =>
  canManageBilling.value ? 'owner' : 'member'
)

const load = computed(() =>
  deriveBillingTabLoad({
    billingError: billing.error.value,
    billingInitialized: billing.isInitialized.value,
    capabilitiesReady: capabilities.isReady.value,
    capabilitiesResolved: capabilities.hasResolvedCapabilities.value
  })
)

const action = computed(() =>
  planRowAction(planRow.value, {
    canSubscribeSelfServe: capabilities.canSubscribeSelfServe.value
  })
)

const handoffUrl = computed(() =>
  platformLink(HANDOFF_PATH[handoffAudience.value])
)

async function retry() {
  await Promise.allSettled([billing.initialize(), capabilities.refresh()])
}

onMounted(() => {
  if (!billing.isInitialized.value && !billing.isLoading.value) {
    void billing.initialize().catch(() => undefined)
  }
  void capabilities.initialize()
})
</script>
