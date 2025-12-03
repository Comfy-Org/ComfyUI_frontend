<template>
  <div
    class="upload-model-upgrade-modal flex flex-col justify-between gap-10 p-4 border-t-[1px] border-border-default"
  >
    <!-- Upgrade Content -->
    <UploadModelUpgradeModalBody />

    <!-- Footer -->
    <UploadModelUpgradeModalFooter
      @close="handleClose"
      @subscribe="handleSubscribe"
    />
  </div>
</template>

<script setup lang="ts">
import UploadModelUpgradeModalBody from '@/platform/assets/components/UploadModelUpgradeModalBody.vue'
import UploadModelUpgradeModalFooter from '@/platform/assets/components/UploadModelUpgradeModalFooter.vue'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { useDialogStore } from '@/stores/dialogStore'

const dialogStore = useDialogStore()
const { showSubscriptionDialog } = useSubscription()

function handleClose() {
  dialogStore.closeDialog({ key: 'upload-model-upgrade' })
}

function handleSubscribe() {
  showSubscriptionDialog()
}
</script>

<style scoped>
.upload-model-upgrade-modal {
  width: auto;
  max-width: min(500px, 90vw);
}
</style>
