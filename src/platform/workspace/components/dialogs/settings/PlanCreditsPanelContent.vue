<template>
  <div
    :class="
      cn(
        '@container flex min-h-0 flex-1 flex-col gap-4',
        // The panel runs flush to the bottom edge (BaseModalLayout 'flush');
        // Invoices keeps its prior bottom gap, Overview doesn't.
        activeView !== 'overview' && 'pb-6'
      )
    "
  >
    <div class="flex w-full items-center gap-2">
      <Button
        v-for="tab in tabs"
        :key="tab.key"
        :variant="activeView === tab.key ? 'secondary' : 'muted-textonly'"
        size="lg"
        @click="setView(tab.key)"
      >
        {{ tab.label }}
      </Button>
    </div>

    <BillingStatusBanner>
      <template #actions>
        <Button
          v-if="activeView === 'invoices' && isPaused"
          variant="textonly"
          size="lg"
          @click="openInvoiceHistory"
        >
          {{ $t('workspacePanel.invoices.fullHistory') }}
          <i class="icon-[lucide--external-link] size-4" />
        </Button>
      </template>
    </BillingStatusBanner>

    <WorkspaceOverviewContent v-if="activeView === 'overview'" />
    <WorkspaceInvoicesContent v-else />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import BillingStatusBanner from '@/platform/workspace/components/dialogs/settings/BillingStatusBanner.vue'
import WorkspaceOverviewContent from '@/platform/workspace/components/dialogs/settings/WorkspaceOverviewContent.vue'
import WorkspaceInvoicesContent from '@/platform/workspace/components/dialogs/settings/WorkspaceInvoicesContent.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { cn } from '@comfyorg/tailwind-utils'

type View = 'overview' | 'invoices'

const { t } = useI18n()

const { permissions } = useWorkspaceUI()
const { isPaused, manageSubscription } = useBillingContext()

function openInvoiceHistory() {
  void manageSubscription()
}

const tabs = computed(() => {
  const base: { key: View; label: string }[] = [
    { key: 'overview', label: t('workspacePanel.planCredits.tabs.overview') }
  ]
  // Invoices are billing details — owners/admins only.
  if (permissions.value.canManageSubscription) {
    base.push({
      key: 'invoices',
      label: t('workspacePanel.planCredits.tabs.invoices')
    })
  }
  return base
})
const activeView = ref<View>('overview')

function setView(view: View) {
  activeView.value = view
}
</script>
