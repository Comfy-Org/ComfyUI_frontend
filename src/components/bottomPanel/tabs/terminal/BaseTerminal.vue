<template>
  <div
    ref="rootEl"
    class="relative overflow-hidden h-full w-full bg-neutral-900"
  >
    <div class="p-terminal rounded-none h-full w-full p-2">
      <div ref="terminalEl" class="h-full terminal-host" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Ref, onUnmounted, ref } from 'vue'

import { useTerminal } from '@/composables/bottomPanelTabs/useTerminal'

const emit = defineEmits<{
  created: [ReturnType<typeof useTerminal>, Ref<HTMLElement | undefined>]
  unmounted: []
}>()
const terminalEl = ref<HTMLElement | undefined>()
const rootEl = ref<HTMLElement | undefined>()
emit('created', useTerminal(terminalEl), rootEl)

onUnmounted(() => emit('unmounted'))
</script>

<style scoped>
:deep(.p-terminal) .xterm {
  overflow: hidden;
}

:deep(.p-terminal) .xterm-screen {
  @apply bg-neutral-900;
  overflow: hidden;
}
</style>
