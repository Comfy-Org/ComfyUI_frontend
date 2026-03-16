<template>
  <router-view />
  <GlobalDialog />
  <BlockUI full-screen :blocked="isLoading" />
</template>

<script setup lang="ts">
import { captureException } from '@sentry/vue'
import BlockUI from 'primevue/blockui'
import { computed, onMounted, watch } from 'vue'

import { useI18n } from 'vue-i18n'

import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import config from '@/config'
import { isDesktop } from '@/platform/distribution/types'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { app } from '@/scripts/app'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { electronAPI } from '@/utils/envUtil'
import { parsePreloadError } from '@/utils/preloadErrorUtil'
import { useConflictDetection } from '@/workbench/extensions/manager/composables/useConflictDetection'

const { t } = useI18n()
const workspaceStore = useWorkspaceStore()
app.extensionManager = useWorkspaceStore()

const conflictDetection = useConflictDetection()
const isLoading = computed<boolean>(() => workspaceStore.spinner)

watch(
  isLoading,
  (loading, prevLoading) => {
    if (prevLoading && !loading) {
      document.getElementById('splash-loader')?.remove()
    }
  },
  { flush: 'post' }
)

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

function handleResourceError(url: string, tagName: string) {
  console.error('[resource:loadError]', { url, tagName })

  if (__DISTRIBUTION__ === 'cloud') {
    captureException(new Error(`Resource load failed: ${url}`), {
      tags: {
        error_type: 'resource_load_error',
        tag_name: tagName
      }
    })
  }
}

onMounted(() => {
  window['__COMFYUI_FRONTEND_VERSION__'] = config.app_version

  if (isDesktop) {
    document.addEventListener('contextmenu', showContextMenu)
  }

  // Handle preload errors that occur during dynamic imports (e.g., stale chunks after deployment)
  // See: https://vite.dev/guide/build#load-error-handling
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    const info = parsePreloadError(event.payload)
    console.error('[vite:preloadError]', {
      url: info.url,
      fileType: info.fileType,
      chunkName: info.chunkName,
      message: info.message
    })
    if (__DISTRIBUTION__ === 'cloud') {
      captureException(event.payload, {
        tags: {
          error_type: 'vite_preload_error',
          file_type: info.fileType,
          chunk_name: info.chunkName ?? undefined
        },
        contexts: {
          preload: {
            url: info.url,
            fileType: info.fileType,
            chunkName: info.chunkName
          }
        }
      })
    }
    useToastStore().add({
      severity: 'error',
      summary: t('g.preloadErrorTitle'),
      detail: t('g.preloadError'),
      life: 10000
    })
  })

  // Capture resource load failures (CSS, scripts) in non-localhost distributions
  if (__DISTRIBUTION__ !== 'localhost') {
    window.addEventListener(
      'error',
      (event) => {
        const target = event.target
        if (target instanceof HTMLScriptElement) {
          handleResourceError(target.src, 'script')
        } else if (
          target instanceof HTMLLinkElement &&
          target.rel === 'stylesheet'
        ) {
          handleResourceError(target.href, 'link')
        }
      },
      true
    )
  }

  // Initialize conflict detection in background
  // This runs async and doesn't block UI setup
  void conflictDetection.initializeConflictDetection()
})
</script>
