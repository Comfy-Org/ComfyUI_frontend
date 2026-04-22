<template>
  <div
    ref="rootEl"
    data-testid="terminal-root"
    class="relative size-full overflow-hidden bg-neutral-900"
  >
    <div class="p-terminal size-full rounded-none p-2">
      <div
        ref="terminalEl"
        data-testid="terminal-host"
        class="terminal-host h-full"
      />
    </div>
    <Button
      v-tooltip.left="{
        value: tooltipText,
        showDelay: 300
      }"
      data-testid="terminal-copy-button"
      variant="secondary"
      size="sm"
      :class="
        cn('absolute top-2 right-8 transition-opacity', {
          'pointer-events-none opacity-0 select-none': !isHovered
        })
      "
      :aria-label="tooltipText"
      @click="handleCopy"
    >
      <i class="pi pi-copy" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { useElementHover, useEventListener } from '@vueuse/core'
import type { IDisposable } from '@xterm/xterm'
import type { Ref } from 'vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useTerminal } from '@/composables/bottomPanelTabs/useTerminal'
import { electronAPI } from '@/utils/envUtil'
import { isDesktop } from '@/platform/distribution/types'
import { cn } from '@/utils/tailwindUtil'

const { t } = useI18n()

const emit = defineEmits<{
  created: [ReturnType<typeof useTerminal>, Ref<HTMLElement | undefined>]
  unmounted: []
}>()
const terminalEl = ref<HTMLElement | undefined>()
const rootEl = ref<HTMLElement | undefined>()
const hasSelection = ref(false)

const isHovered = useElementHover(rootEl)

const terminalData = useTerminal(terminalEl)
emit('created', terminalData, ref(rootEl))

const { terminal } = terminalData
let selectionDisposable: IDisposable | undefined

const tooltipText = computed(() => {
  return hasSelection.value
    ? t('serverStart.copySelectionTooltip')
    : t('serverStart.copyAllTooltip')
})

const handleCopy = async () => {
  const existingSelection = terminal.getSelection()
  const shouldSelectAll = !existingSelection
  if (shouldSelectAll) terminal.selectAll()

  const selectedText = shouldSelectAll
    ? terminal.getSelection()
    : existingSelection

  if (selectedText) {
    await navigator.clipboard.writeText(selectedText)

    if (shouldSelectAll) {
      terminal.clearSelection()
    }
  }
}

const showContextMenu = (event: MouseEvent) => {
  event.preventDefault()
  electronAPI()?.showContextMenu({ type: 'text' })
}

if (isDesktop) {
  useEventListener(terminalEl, 'contextmenu', showContextMenu)
}

onMounted(() => {
  selectionDisposable = terminal.onSelectionChange(() => {
    hasSelection.value = terminal.hasSelection()
  })
})

onUnmounted(() => {
  selectionDisposable?.dispose()
  emit('unmounted')
})
</script>

<style scoped>
:deep(.p-terminal) .xterm {
  overflow: hidden;
}

:deep(.p-terminal) .xterm-screen {
  overflow: hidden;
  background-color: var(--color-neutral-900);
}
</style>
