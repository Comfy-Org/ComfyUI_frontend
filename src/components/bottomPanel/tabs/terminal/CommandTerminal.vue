<template>
  <div class="relative size-full">
    <BaseTerminal @created="terminalCreated" />
    <div
      v-if="exited"
      data-testid="terminal-session-ended"
      class="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-neutral-800 px-3 py-2 text-sm text-neutral-200"
    >
      <span>{{ $t('terminal.sessionEnded') }}</span>
      <Button
        v-if="canRestart"
        size="sm"
        variant="secondary"
        data-testid="terminal-restart-button"
        @click="restart"
      >
        {{ $t('terminal.restart') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { IDisposable, Terminal } from '@xterm/xterm'
import type { Ref } from 'vue'
import { onMounted, onUnmounted, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import type { useTerminal } from '@/composables/bottomPanelTabs/useTerminal'
import { getTerminalBridge } from '@/composables/bottomPanelTabs/useTerminalBridge'
import type {
  TerminalBridge,
  TerminalRestore
} from '@/composables/bottomPanelTabs/useTerminalBridge'

import BaseTerminal from './BaseTerminal.vue'

const exited = ref(false)
const canRestart = ref(false)

let bridge: TerminalBridge | null = null
let terminal: Terminal | null = null

const applyRestore = (restore: TerminalRestore) => {
  if (!terminal) return
  if (restore.buffer.length) {
    terminal.resize(restore.size.cols, restore.size.rows)
    terminal.write(restore.buffer.join(''))
  }
  exited.value = restore.exited ?? false
}

const restart = async () => {
  if (!bridge?.restart || !terminal) return
  terminal.reset()
  exited.value = false
  applyRestore(await bridge.restart())
}

const terminalCreated = (
  { terminal: term, useAutoSize }: ReturnType<typeof useTerminal>,
  root: Ref<HTMLElement | undefined>
) => {
  bridge = getTerminalBridge()
  if (!bridge) return
  const activeBridge = bridge
  terminal = term
  canRestart.value = activeBridge.restart !== null

  let offData: IDisposable
  let offOutput: () => void
  let offExited: (() => void) | undefined

  useAutoSize({
    root,
    autoRows: true,
    autoCols: true,
    onResize: async () => {
      // If we aren't visible, don't resize
      if (!term.element?.offsetParent) return
      await activeBridge.resize(term.cols, term.rows)
    }
  })

  onMounted(async () => {
    offData = term.onData(async (message: string) => {
      await activeBridge.write(message)
    })
    offOutput = activeBridge.onOutput((message) => {
      term.write(message)
    })
    offExited = activeBridge.onExited?.(() => {
      exited.value = true
    })

    const restore = await activeBridge.subscribe()
    // "Pulling it up again restarts it": if the user had killed the session,
    // re-opening the tab silently brings it back.
    if (restore.exited && activeBridge.restart) {
      await restart()
    } else {
      setTimeout(() => applyRestore(restore), 500)
    }
  })

  onUnmounted(() => {
    offData?.dispose()
    offOutput?.()
    offExited?.()
  })
}
</script>

<style scoped>
:deep(.p-terminal) .xterm {
  overflow-x: auto;
}

:deep(.p-terminal) .xterm-screen {
  overflow-y: hidden;
}
</style>
