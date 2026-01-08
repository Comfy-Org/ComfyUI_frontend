<template>
  <router-view />
  <ProgressSpinner
    v-if="isLoading"
    class="absolute inset-0 flex h-[unset] items-center justify-center"
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
import { t } from '@/i18n'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import { useDialogService } from '@/services/dialogService'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useConflictDetection } from '@/workbench/extensions/manager/composables/useConflictDetection'

import { electronAPI, isElectron } from './utils/envUtil'

const workspaceStore = useWorkspaceStore()
const conflictDetection = useConflictDetection()
const workflowStore = useWorkflowStore()
const dialogService = useDialogService()
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

  if (isElectron()) {
    document.addEventListener('contextmenu', showContextMenu)
  }

  // Handle Vite preload errors (e.g., when assets are deleted after deployment)
  window.addEventListener('vite:preloadError', async (_event) => {
    // Auto-reload if app is not ready or there are no unsaved changes
    if (!app.vueAppReady || !workflowStore.activeWorkflow?.isModified) {
      window.location.reload()
    } else {
      // Show confirmation dialog if there are unsaved changes
      await dialogService
        .confirm({
          title: t('g.vitePreloadErrorTitle'),
          message: t('g.vitePreloadErrorMessage')
        })
        .then((confirmed) => {
          if (confirmed) {
            window.location.reload()
          }
        })
    }
  })

  // Initialize conflict detection in background
  // This runs async and doesn't block UI setup
  void conflictDetection.initializeConflictDetection()
})
</script>
