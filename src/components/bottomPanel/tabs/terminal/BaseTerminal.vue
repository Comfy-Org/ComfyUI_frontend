<template>
  <div class="relative h-full w-full bg-black" ref="rootEl">
    <div class="p-terminal rounded-none h-full w-full p-2">
      <div class="h-full terminal-host" ref="terminalEl"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, Ref } from 'vue'
import { useTerminal } from '@/hooks/bottomPanelTabs/useTerminal'

const emit = defineEmits<{
  created: [ReturnType<typeof useTerminal>, Ref<HTMLElement>]
}>()
const terminalEl = ref<HTMLElement>()
const rootEl = ref<HTMLElement>()
emit('created', useTerminal(terminalEl), rootEl)
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
