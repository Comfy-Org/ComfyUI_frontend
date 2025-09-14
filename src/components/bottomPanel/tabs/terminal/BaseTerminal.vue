<template>
  <div
    ref="rootEl"
    class="relative overflow-hidden h-full w-full bg-black"
    @mouseenter="showCopyButton = true"
    @mouseleave="showCopyButton = false"
  >
    <div class="p-terminal rounded-none h-full w-full p-2">
      <div ref="terminalEl" class="h-full terminal-host" />
    </div>
    <Button
      v-if="showCopyButton"
      icon="pi pi-copy"
      severity="secondary"
      size="small"
      class="absolute top-2 right-2 opacity-0 animate-fade-in"
      :class="{ 'opacity-100': showCopyButton }"
      :aria-label="t('serverStart.copyTerminal')"
      @click="handleCopy"
    />
  </div>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import Button from 'primevue/button'
import { Ref, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useTerminal } from '@/composables/bottomPanelTabs/useTerminal'
import { electronAPI, isElectron } from '@/utils/envUtil'

const { t } = useI18n()

const emit = defineEmits<{
  created: [ReturnType<typeof useTerminal>, Ref<HTMLElement | undefined>]
  unmounted: []
  copyTerminal: []
}>()
const terminalEl = ref<HTMLElement | undefined>()
const rootEl = ref<HTMLElement | undefined>()
const showCopyButton = ref(false)

emit('created', useTerminal(terminalEl), rootEl)

const handleCopy = () => {
  emit('copyTerminal')
}

const showContextMenu = (event: MouseEvent) => {
  event.preventDefault()
  electronAPI()?.showContextMenu({ type: 'text' })
}

if (isElectron()) {
  useEventListener(terminalEl, 'contextmenu', showContextMenu)
}

onUnmounted(() => emit('unmounted'))
</script>

<style scoped>
:deep(.p-terminal) .xterm {
  overflow-x: auto;
}

:deep(.p-terminal) .xterm-screen {
  background-color: black;
  overflow-y: hidden;
}

.animate-fade-in {
  transition: opacity 0.2s ease-in-out;
}
</style>
