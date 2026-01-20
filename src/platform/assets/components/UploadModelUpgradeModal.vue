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
