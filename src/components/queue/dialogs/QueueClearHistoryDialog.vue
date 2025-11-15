<template>
  <section
    class="w-[360px] rounded-2xl border border-interface-stroke bg-interface-panel-surface text-text-primary shadow-interface font-inter"
  >
    <header
      class="flex items-center justify-between border-b border-interface-stroke px-4 py-4"
    >
      <p class="m-0 text-[14px] font-normal leading-none">
        {{ t('sideToolbar.queueProgressOverlay.clearHistoryDialogTitle') }}
      </p>
      <button
        class="inline-flex size-6 cursor-pointer items-center justify-center rounded border-0 bg-transparent p-0 text-text-secondary transition hover:bg-secondary-background hover:opacity-100"
        :aria-label="t('g.close')"
        @click="onCancel"
      >
        <i class="icon-[lucide--x] block size-4 leading-none" />
      </button>
    </header>

    <div class="flex flex-col gap-4 px-4 py-4 text-[14px] text-text-secondary">
      <p class="m-0">
        {{
          t('sideToolbar.queueProgressOverlay.clearHistoryDialogDescription')
        }}
      </p>
      <p class="m-0">
        {{ t('sideToolbar.queueProgressOverlay.clearHistoryDialogAssetsNote') }}
      </p>
    </div>

    <footer class="flex items-center justify-end px-4 py-4">
      <div class="flex items-center gap-4 text-[14px] leading-none">
        <button
          class="inline-flex min-h-[24px] cursor-pointer items-center rounded-md border-0 bg-transparent px-1 py-1 text-[14px] leading-[1] text-text-secondary transition hover:text-text-primary"
          :aria-label="t('g.cancel')"
          @click="onCancel"
        >
          {{ t('g.cancel') }}
        </button>
        <button
          class="inline-flex min-h-[32px] items-center rounded-lg border-0 bg-secondary-background px-4 py-2 text-[12px] font-normal leading-[1] text-text-primary transition hover:bg-secondary-background-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
          :aria-label="t('g.clear')"
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
