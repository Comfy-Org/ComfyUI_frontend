<template>
  <AppDialogPanel
    size="compact"
    body-class="flex flex-col gap-4 text-[14px] text-muted-foreground"
    @close="onCancel"
  >
    <template #title>
      {{ t('sideToolbar.queueProgressOverlay.clearHistoryDialogTitle') }}
    </template>

    <p class="m-0">
      {{ t('sideToolbar.queueProgressOverlay.clearHistoryDialogDescription') }}
    </p>
    <p class="m-0">
      {{ t('sideToolbar.queueProgressOverlay.clearHistoryDialogAssetsNote') }}
    </p>

    <template #footer>
      <div class="flex items-center gap-4 leading-none">
        <Button variant="muted-textonly" size="lg" @click="onCancel">
          {{ t('g.cancel') }}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          :disabled="isClearing"
          @click="onConfirm"
          >{{ t('g.clear') }}</Button
        >
      </div>
    </template>
  </AppDialogPanel>
</template>

<script setup lang="ts">
import AppDialogPanel from '@/components/dialog/AppDialogPanel.vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useDialogStore } from '@/stores/dialogStore'
import { useQueueStore } from '@/stores/queueStore'

const dialogStore = useDialogStore()
const queueStore = useQueueStore()
const { t } = useI18n()
const { wrapWithErrorHandlingAsync } = useErrorHandling()

const isClearing = ref(false)

const clearHistory = wrapWithErrorHandlingAsync(
  async () => {
    await queueStore.clear(['history'])
    dialogStore.closeDialog()
  },
  undefined,
  () => {
    isClearing.value = false
  }
)

const onConfirm = async () => {
  if (isClearing.value) return
  isClearing.value = true
  await clearHistory()
}

const onCancel = () => {
  dialogStore.closeDialog()
}
</script>
