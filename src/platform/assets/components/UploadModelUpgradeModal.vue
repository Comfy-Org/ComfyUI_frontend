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
import { useBillingDialogs } from '@/composables/billing/useBillingDialogs'
import UploadModelUpgradeModalBody from '@/platform/assets/components/UploadModelUpgradeModalBody.vue'
import UploadModelUpgradeModalFooter from '@/platform/assets/components/UploadModelUpgradeModalFooter.vue'
import { useDialogStore } from '@/stores/dialogStore'

const dialogStore = useDialogStore()
const { showSubscriptionRequiredDialog } = useBillingDialogs()

function handleClose() {
  dialogStore.closeDialog({ key: 'upload-model-upgrade' })
}

function handleSubscribe() {
  void showSubscriptionRequiredDialog({ reason: 'upload_model_upgrade' })
}
</script>
