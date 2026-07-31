<template>
  <div
    class="flex items-center justify-between border-t border-interface-stroke pt-3"
  >
    <div class="flex gap-2">
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
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import { useExternalLink } from '@/composables/useExternalLink'
import { useSubscriptionActions } from '@/platform/cloud/subscription/composables/useSubscriptionActions'

const { buildDocsUrl, docsPaths } = useExternalLink()

const { isLoadingSupport, handleMessageSupport, handleLearnMoreClick } =
  useSubscriptionActions()

function handleOpenPartnerNodesInfo() {
  window.open(
    buildDocsUrl(docsPaths.partnerNodesPricing, { includeLocale: true }),
    '_blank'
  )
}
</script>
