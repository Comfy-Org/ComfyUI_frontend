<template>
  <WorkspaceAuthGate>
    <router-view />
    <ProgressSpinner
      v-if="isLoading"
      class="absolute inset-0 flex h-[unset] items-center justify-center"
    />
    <GlobalDialog />
    <BlockUI full-screen :blocked="isLoading" />
  </WorkspaceAuthGate>
</template>

<script setup lang="ts">
import { captureException } from '@sentry/vue'
import BlockUI from 'primevue/blockui'
import ProgressSpinner from 'primevue/progressspinner'
import { computed, onMounted } from 'vue'

import WorkspaceAuthGate from '@/components/auth/WorkspaceAuthGate.vue'
import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import config from '@/config'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useConflictDetection } from '@/workbench/extensions/manager/composables/useConflictDetection'

import { electronAPI, isElectron } from './utils/envUtil'
import { app } from '@/scripts/app'

const workspaceStore = useWorkspaceStore()
app.extensionManager = useWorkspaceStore()

const conflictDetection = useConflictDetection()
const isLoading = computed<boolean>(() => workspaceStore.spinner)

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

  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    // eslint-disable-next-line no-undef
    if (__DISTRIBUTION__ === 'cloud') {
      captureException(event.payload, {
        tags: { error_type: 'vite_preload_error' }
      })
    } else {
      console.error('[vite:preloadError]', event.payload)
    }
  })

  // Initialize conflict detection in background
  // This runs async and doesn't block UI setup
  void conflictDetection.initializeConflictDetection()
})
</script>
