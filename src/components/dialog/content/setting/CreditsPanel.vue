<template>
  <div class="credits-container flex h-full flex-col gap-4">
    <div>
      <h2 class="mb-2 text-2xl font-bold">
        {{ $t('credits.credits') }}
      </h2>
      <Divider />
    </div>

    <CreditsTile />

    <div class="flex items-center justify-between">
      <h3 class="m-0">{{ $t('credits.activity') }}</h3>
      <Button variant="muted-textonly" @click="handleCreditsHistoryClick">
        <i class="pi pi-arrow-up-right" />
        {{ $t('credits.invoiceHistory') }}
      </Button>
    </div>

    <UsageLogsTable ref="usageLogsTableRef" />

    <div class="flex flex-row gap-2">
      <Button variant="muted-textonly" @click="handleFaqClick">
        <i class="pi pi-question-circle" />
        {{ $t('credits.faqs') }}
      </Button>
      <Button variant="muted-textonly" @click="handleOpenPartnerNodesInfo">
        <i class="pi pi-question-circle" />
        {{ $t('subscription.partnerNodesCredits') }}
      </Button>
      <Button variant="muted-textonly" @click="handleMessageSupport">
        <i class="pi pi-comments" />
        {{ $t('credits.messageSupport') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Divider from 'primevue/divider'
import { ref, watch } from 'vue'

import UsageLogsTable from '@/components/dialog/content/setting/UsageLogsTable.vue'
import Button from '@/components/ui/button/Button.vue'
import { useAuthActions } from '@/composables/auth/useAuthActions'
import { useExternalLink } from '@/composables/useExternalLink'
import CreditsTile from '@/platform/cloud/subscription/components/CreditsTile.vue'
import { useTelemetry } from '@/platform/telemetry'
import { useAuthStore } from '@/stores/authStore'
import { useCommandStore } from '@/stores/commandStore'

const { buildDocsUrl, docsPaths } = useExternalLink()
const authStore = useAuthStore()
const authActions = useAuthActions()
const commandStore = useCommandStore()
const telemetry = useTelemetry()

const usageLogsTableRef = ref<InstanceType<typeof UsageLogsTable> | null>(null)

watch(
  () => authStore.lastBalanceUpdateTime,
  (newTime, oldTime) => {
    if (newTime && newTime !== oldTime && usageLogsTableRef.value) {
      void usageLogsTableRef.value.refresh()
    }
  }
)

const handleCreditsHistoryClick = async () => {
  await authActions.accessBillingPortal()
}

const handleMessageSupport = async () => {
  telemetry?.trackHelpResourceClicked({
    resource_type: 'help_feedback',
    is_external: true,
    source: 'credits_panel'
  })
  await commandStore.execute('Comfy.ContactSupport')
}

const handleFaqClick = () => {
  window.open(
    buildDocsUrl('/tutorials/api-nodes/faq', { includeLocale: true }),
    '_blank',
    'noopener,noreferrer'
  )
}

const handleOpenPartnerNodesInfo = () => {
  window.open(
    buildDocsUrl(docsPaths.partnerNodesPricing, { includeLocale: true }),
    '_blank',
    'noopener,noreferrer'
  )
}
</script>
