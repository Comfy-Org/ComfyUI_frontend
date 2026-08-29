<template>
  <div
    :class="
      cn(
        'credits-container flex flex-col gap-4',
        embedded ? 'shrink-0' : 'h-full'
      )
    "
  >
    <div v-if="!embedded">
      <h2 class="mb-2 text-2xl font-bold">
        {{ $t('credits.credits') }}
      </h2>
      <div class="border-t border-interface-stroke" />
    </div>

    <div v-if="embedded" class="rounded-2xl border border-interface-stroke p-6">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="m-0 text-base font-semibold">
          {{ $t('credits.workspaceCredits') }}
        </h3>
        <Button
          variant="secondary"
          size="lg"
          @click="handleCreditsHistoryClick"
        >
          {{ $t('subscription.manageBilling') }}
        </Button>
      </div>
      <CreditsTile class="max-w-md" />
    </div>
    <CreditsTile v-else />

    <div v-if="!embedded" class="flex items-center justify-between">
      <h3 class="m-0">{{ $t('credits.activity') }}</h3>
      <Button variant="muted-textonly" @click="handleCreditsHistoryClick">
        <i class="pi pi-arrow-up-right" />
        {{ $t('credits.invoiceHistory') }}
      </Button>
    </div>

    <UsageLogsTable v-if="!embedded" ref="usageLogsTableRef" />

    <div v-if="!embedded" class="flex flex-row gap-2">
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
import { cn } from '@comfyorg/tailwind-utils'
import { ref, watch } from 'vue'

import UsageLogsTable from '@/components/dialog/content/setting/UsageLogsTable.vue'
import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useExternalLink } from '@/composables/useExternalLink'
import CreditsTile from '@/platform/cloud/subscription/components/CreditsTile.vue'
import { useTelemetry } from '@/platform/telemetry'
import { useCommandStore } from '@/stores/commandStore'

const { embedded = false } = defineProps<{
  embedded?: boolean
}>()

const { buildDocsUrl, docsPaths } = useExternalLink()
const { balance, manageSubscription } = useBillingContext()
const commandStore = useCommandStore()
const telemetry = useTelemetry()

const usageLogsTableRef = ref<InstanceType<typeof UsageLogsTable> | null>(null)

watch(balance, (next, previous) => {
  if (!next || !previous) return
  void usageLogsTableRef.value?.refresh()
})

const handleCreditsHistoryClick = async () => {
  await manageSubscription()
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
