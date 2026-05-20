<template>
  <div
    class="flex w-auto max-w-[min(500px,90vw)] flex-col justify-between gap-10 border-t border-border-default p-4"
  >
    <UploadModelUpgradeModalBody />

    <UploadModelUpgradeModalFooter
      @close="handleClose"
      @subscribe="handleSubscribe"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import UploadModelUpgradeModalBody from '@/platform/assets/components/UploadModelUpgradeModalBody.vue'
import UploadModelUpgradeModalFooter from '@/platform/assets/components/UploadModelUpgradeModalFooter.vue'
import { useTelemetry } from '@/platform/telemetry'
import { useDialogStore } from '@/stores/dialogStore'

const dialogStore = useDialogStore()
const { showSubscriptionDialog, subscription } = useBillingContext()

function handleClose() {
  dialogStore.closeDialog({ key: 'upload-model-upgrade' })
}

function handleSubscribe() {
  showSubscriptionDialog()
}

onMounted(() => {
  useTelemetry()?.trackPaywallViewed({
    surface: 'upload_model_upgrade_modal',
    current_tier: subscription.value?.tier?.toLowerCase()
  })
})
</script>
