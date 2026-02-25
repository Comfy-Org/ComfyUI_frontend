<template>
  <div
    class="fixed bottom-4 left-1/2 z-[1000] flex -translate-x-1/2 items-center rounded-2xl border border-border-default bg-base-background p-2 shadow-interface"
  >
    <button
      class="flex h-10 min-h-8 cursor-pointer items-center justify-center rounded-lg bg-secondary-background px-3 py-2 text-sm transition-colors border-none hover:bg-secondary-background-hover"
      @click="onExitBuilder"
    >
      {{ t('builderMenu.exitAppBuilder') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { useAppModeStore } from '@/stores/appModeStore'

const { t } = useI18n()
const appModeStore = useAppModeStore()

function onExitBuilder() {
  void appModeStore.exitBuilder()
}
</script>
