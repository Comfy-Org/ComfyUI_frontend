<template>
  <BaseViewTemplate dark>
    <div
      class="h-screen w-screen grid items-center justify-around overflow-y-auto"
    >
      <div class="relative m-8 text-center">
        <!-- Header -->
        <h1 class="download-bg pi-download text-4xl font-bold">
          {{ t('desktopUpdate.title') }}
        </h1>

        <div class="m-8">
          <span>{{ t('desktopUpdate.description') }}</span>
        </div>

        <ProgressSpinner class="m-8 w-48 h-48" />

        <!-- Console button -->
        <Button
          style="transform: translateX(-50%)"
          class="fixed bottom-0 left-1/2 my-8"
          :label="t('maintenance.consoleLogs')"
          icon="pi pi-desktop"
          icon-pos="left"
          severity="secondary"
          @click="toggleConsoleDrawer"
        />

        <Drawer
          v-model:visible="terminalVisible"
          :header="t('g.terminal')"
          position="bottom"
          style="height: max(50vh, 34rem)"
        >
          <BaseTerminal
            @created="terminalCreated"
            @unmounted="terminalUnmounted"
          />
        </Drawer>
      </div>
    </div>
    <Toast />
  </BaseViewTemplate>
</template>

<script setup lang="ts">
import { Terminal } from '@xterm/xterm'
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import ProgressSpinner from 'primevue/progressspinner'
import Toast from 'primevue/toast'
import { Ref, onMounted, onUnmounted, ref } from 'vue'

import BaseTerminal from '@/components/bottomPanel/tabs/terminal/BaseTerminal.vue'
import type { useTerminal } from '@/hooks/bottomPanelTabs/useTerminal'
import { useTerminalBuffer } from '@/hooks/bottomPanelTabs/useTerminalBuffer'
import { t } from '@/i18n'
import { electronAPI } from '@/utils/envUtil'

import BaseViewTemplate from './templates/BaseViewTemplate.vue'

const electron = electronAPI()

const terminalVisible = ref(false)

/** The actual output of all terminal commands - not rendered */
const buffer = useTerminalBuffer()
let xterm: Terminal | null = null

// Created and destroyed with the Drawer - contents copied from hidden buffer
const terminalCreated = (
  { terminal, useAutoSize }: ReturnType<typeof useTerminal>,
  root: Ref<HTMLElement>
) => {
  xterm = terminal
  useAutoSize({ root, autoRows: true, autoCols: true })
  terminal.write(t('desktopUpdate.terminalDefaultMessage'))
  buffer.copyTo(terminal)

  terminal.options.cursorBlink = false
  terminal.options.cursorStyle = 'bar'
  terminal.options.cursorInactiveStyle = 'bar'
  terminal.options.disableStdin = true
}

const terminalUnmounted = () => {
  xterm = null
}

const toggleConsoleDrawer = () => {
  terminalVisible.value = !terminalVisible.value
}

onMounted(async () => {
  electron.onLogMessage((message: string) => {
    buffer.write(message)
    xterm?.write(message)
  })
})

onUnmounted(() => electron.Validation.dispose())
</script>

<style scoped>
.download-bg::before {
  @apply m-0 absolute text-muted;
  font-family: 'primeicons';
  top: -2rem;
  right: 2rem;
  speak: none;
  font-style: normal;
  font-weight: normal;
  font-variant: normal;
  text-transform: none;
  line-height: 1;
  display: inline-block;
  -webkit-font-smoothing: antialiased;
  opacity: 0.02;
  font-size: min(14rem, 90vw);
  z-index: 0;
}
</style>
