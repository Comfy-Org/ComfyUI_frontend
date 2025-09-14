<template>
  <div ref="rootEl" class="relative overflow-hidden h-full w-full bg-black">
    <div class="p-terminal rounded-none h-full w-full p-2">
      <div ref="terminalEl" class="h-full terminal-host" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Ref, onMounted, onUnmounted, ref } from 'vue'

import { useTerminal } from '@/composables/bottomPanelTabs/useTerminal'
import { electronAPI, isElectron } from '@/utils/envUtil'

const emit = defineEmits<{
  created: [ReturnType<typeof useTerminal>, Ref<HTMLElement | undefined>]
  unmounted: []
}>()
const terminalEl = ref<HTMLElement | undefined>()
const rootEl = ref<HTMLElement | undefined>()
emit('created', useTerminal(terminalEl), rootEl)

const showContextMenu = (event: MouseEvent) => {
  event.preventDefault()
  electronAPI()?.showContextMenu({ type: 'text' })
}

onMounted(() => {
  if (isElectron() && terminalEl.value) {
    terminalEl.value.addEventListener('contextmenu', showContextMenu)
  }
})

onUnmounted(() => {
  if (isElectron() && terminalEl.value) {
    terminalEl.value.removeEventListener('contextmenu', showContextMenu)
  }
  emit('unmounted')
})
</script>

<style scoped>
:deep(.p-terminal) .xterm {
  overflow-x: auto;
}

:deep(.p-terminal) .xterm-screen {
  background-color: black;
  overflow-y: hidden;
}
</style>
