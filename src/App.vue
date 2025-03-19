<template>
  <router-view />
  <ProgressSpinner
    v-if="isLoading"
    class="absolute inset-0 flex justify-center items-center h-screen"
  />
  <GlobalDialog />
  <BlockUI full-screen :blocked="isLoading" />
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import BlockUI from 'primevue/blockui'
import ProgressSpinner from 'primevue/progressspinner'
import { computed, onMounted } from 'vue'

import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import config from '@/config'
import { api } from '@/scripts/api'
import { useWorkspaceStore } from '@/stores/workspaceStore'

import { useDialogService } from './services/dialogService'
import { electronAPI, isElectron } from './utils/envUtil'

const workspaceStore = useWorkspaceStore()
const isLoading = computed<boolean>(() => workspaceStore.spinner)
const handleKey = (e: KeyboardEvent) => {
  workspaceStore.shiftDown = e.shiftKey
}
useEventListener(window, 'keydown', handleKey)
useEventListener(window, 'keyup', handleKey)

const showContextMenu = (event: MouseEvent) => {
  const { target } = event
  switch (true) {
    case target instanceof HTMLTextAreaElement:
    case target instanceof HTMLInputElement && target.type === 'text':
      // TODO: Context input menu explicitly for text input
      electronAPI()?.showContextMenu({ type: 'text' })
      return
  }
}

onMounted(() => {
  window['__COMFYUI_FRONTEND_VERSION__'] = config.app_version
  console.log('ComfyUI Front-end version:', config.app_version)

  if (isElectron()) {
    document.addEventListener('contextmenu', showContextMenu)

    // Handle file drops to import models via electron
    api.addEventListener('unhandledFileDrop', async (e) => {
      e.preventDefault() // Prevent unable to find workflow in file error

      const filePath = await electronAPI()['getFilePath'](e.detail.file)

      if (filePath) {
        useDialogService().showImportModelDialog({
          path: filePath,
          file: e.detail.file
        })
      }
    })
  }
})
</script>
