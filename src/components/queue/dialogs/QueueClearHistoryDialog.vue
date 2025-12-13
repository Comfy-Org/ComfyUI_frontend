<template>
  <section
    class="w-[360px] rounded-2xl border border-interface-stroke bg-interface-panel-surface text-text-primary shadow-interface font-inter"
  >
    <header
      class="flex items-center justify-between border-b border-interface-stroke px-4 py-4"
    >
      <h2 class="m-0 text-sm font-normal text-text-primary">
        {{ t('sideToolbar.queueProgressOverlay.clearHistoryDialogTitle') }}
      </h2>
      <IconButton
        type="transparent"
        size="sm"
        class="size-4 bg-transparent text-text-secondary hover:bg-secondary-background hover:opacity-100"
        :aria-label="t('g.close')"
        @click="onCancel"
      >
        <i class="icon-[lucide--x] block size-4 leading-none" />
      </IconButton>
    </header>

    <div class="flex flex-col gap-6 px-4 py-4">
      <div class="text-sm text-text-secondary">
        {{
          t('sideToolbar.queueProgressOverlay.clearHistoryDialogDescription')
        }}
        <br /><br />
        {{ t('sideToolbar.queueProgressOverlay.clearHistoryDialogAssetsNote') }}
      </div>
    </div>

    <footer class="flex items-center justify-end px-4 py-4">
      <div class="flex items-center gap-4">
        <TextButton
          class="h-6 px-1 py-1 text-sm text-text-secondary hover:text-text-primary"
          type="transparent"
          :label="t('g.cancel')"
          @click="onCancel"
        />
        <button
          class="flex h-10 items-center justify-center rounded-lg border-none bg-destructive-background px-4 py-2 text-sm font-normal text-base-background transition-colors hover:bg-destructive-background-hover disabled:opacity-50"
          :disabled="isClearing"
          @click="onConfirm"
        >
          {{ t('g.clear') }}
        </button>
      </div>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import IconButton from '@/components/button/IconButton.vue'
import TextButton from '@/components/button/TextButton.vue'
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
