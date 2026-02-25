<template>
  <div
    class="fixed bottom-4 left-1/2 z-[1000] flex -translate-x-1/2 items-center rounded-2xl border border-border-default bg-base-background p-2 shadow-interface"
  >
    <Button size="lg" @click="onExitBuilder">
      {{ t('builderMenu.exitAppBuilder') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useAppModeStore } from '@/stores/appModeStore'

const { t } = useI18n()
const appModeStore = useAppModeStore()

useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape' && !e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault()
    e.stopPropagation()
    onExitBuilder()
  }
})

function onExitBuilder() {
  void appModeStore.exitBuilder()
}
</script>
