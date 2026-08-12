<template>
  <div
    class="flex items-center justify-between border-t border-interface-stroke pt-3"
  >
    <div class="flex gap-2">
      <Button
        v-if="isWorkspaceOwner"
        variant="muted-textonly"
        class="text-xs text-text-secondary"
        @click="handleFullUsageActivity"
      >
        <i class="pi pi-external-link text-xs text-text-secondary" />
        {{ $t('subscription.fullUsageActivity') }}
      </Button>
      <Button
        variant="muted-textonly"
        class="text-xs text-text-secondary"
        @click="handleLearnMoreClick"
      >
        <i class="pi pi-question-circle text-xs text-text-secondary" />
        {{ $t('subscription.learnMore') }}
      </Button>
      <Button
        variant="muted-textonly"
        class="text-xs text-text-secondary"
        @click="handleOpenPartnerNodesInfo"
      >
        <i class="pi pi-question-circle text-xs text-text-secondary" />
        {{ $t('subscription.partnerNodesPricingTable') }}
      </Button>
      <Button
        variant="muted-textonly"
        class="text-xs text-text-secondary"
        :loading="isLoadingSupport"
        @click="handleMessageSupport"
      >
        <i class="pi pi-comment text-xs text-text-secondary" />
        {{ $t('subscription.messageSupport') }}
      </Button>
    </div>

    <Button
      v-if="!isCloud && showInvoiceHistory"
      variant="muted-textonly"
      class="text-xs text-text-secondary"
      @click="handleInvoiceHistory"
    >
      {{ $t('subscription.invoiceHistory') }}
      <i class="pi pi-external-link text-xs text-text-secondary" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useExternalLink } from '@/composables/useExternalLink'
import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import { useSubscriptionActions } from '@/platform/cloud/subscription/composables/useSubscriptionActions'
import { isCloud } from '@/platform/distribution/types'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

const { showInvoiceHistory = true } = defineProps<{
  showInvoiceHistory?: boolean
}>()

const { buildDocsUrl, docsPaths } = useExternalLink()

const { workspaceRole } = useWorkspaceUI()

// Personal workspaces resolve to 'owner', so this covers both plan types.
const isWorkspaceOwner = computed(() => workspaceRole.value === 'owner')

const { manageSubscription } = useBillingContext()

const { isLoadingSupport, handleMessageSupport, handleLearnMoreClick } =
  useSubscriptionActions()

async function handleInvoiceHistory() {
  if (!showInvoiceHistory) return
  await manageSubscription()
}

function handleFullUsageActivity() {
  window.open(`${getComfyPlatformBaseUrl()}/profile/usage`, '_blank')
}

function handleOpenPartnerNodesInfo() {
  window.open(
    buildDocsUrl(docsPaths.partnerNodesPricing, { includeLocale: true }),
    '_blank'
  )
}
</script>
