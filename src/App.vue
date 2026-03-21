<template>
  <router-view />
  <GlobalDialog />
  <BlockUI full-screen :blocked="isLoading" />
</template>

<script setup lang="ts">
import { captureException } from '@sentry/vue'
import BlockUI from 'primevue/blockui'
import { computed, onMounted, onUnmounted, watch } from 'vue'

import { useI18n } from 'vue-i18n'

import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import config from '@/config'
import { isDesktop } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { app } from '@/scripts/app'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { electronAPI } from '@/utils/envUtil'
import { parsePreloadError } from '@/utils/preloadErrorUtil'
import { useDialogService } from '@/services/dialogService'
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

const PRELOAD_RECOVERY_KEY = `comfy.preload-recovery:${config.app_version ?? 'unknown'}`
let preloadRecoveryTriggered = false
let preloadToastShown = false

function shouldAttemptPreloadRecovery(): boolean {
  if (preloadRecoveryTriggered) {
    return false
  }

  try {
    return !sessionStorage.getItem(PRELOAD_RECOVERY_KEY)
  } catch {
    return false
  }
}

function markPreloadRecoveryAttempted(): void {
  preloadRecoveryTriggered = true

  try {
    sessionStorage.setItem(PRELOAD_RECOVERY_KEY, '1')
  } catch {
    // Ignore storage access failures and fall through to normal toast handling.
  }
}

function handlePreloadError(event: Event) {
  const preloadEvent = event as Event & {
    payload: Error
    preventDefault: () => void
  }
  preloadEvent.preventDefault()

  const info = parsePreloadError(preloadEvent.payload)
  console.error('[vite:preloadError]', {
    url: info.url,
    fileType: info.fileType,
    chunkName: info.chunkName,
    message: info.message
  })

  if (__DISTRIBUTION__ === 'cloud') {
    captureException(preloadEvent.payload, {
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

  const isResourcePreloadFailure = info.url !== null
  if (isResourcePreloadFailure && shouldAttemptPreloadRecovery()) {
    markPreloadRecoveryAttempted()
    window.location.reload()
    return
  }

  if (!isResourcePreloadFailure) {
    return
  }

  if (preloadToastShown) {
    return
  }

  preloadToastShown = true
  useToastStore().add({
    severity: 'error',
    summary: t('g.preloadErrorTitle'),
    detail: t('g.preloadError'),
    life: 10000
  })
}

onMounted(() => {
  window['__COMFYUI_FRONTEND_VERSION__'] = config.app_version

  if (isDesktop) {
    document.addEventListener('contextmenu', showContextMenu)
  }

  // Handle preload errors that occur during dynamic imports (e.g., stale chunks after deployment)
  // See: https://vite.dev/guide/build#load-error-handling
  window.addEventListener('vite:preloadError', handlePreloadError)

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

  // Show cloud notification for macOS desktop users (one-time)
  if (isDesktop && electronAPI()?.getPlatform() === 'darwin') {
    const settingStore = useSettingStore()
    if (!settingStore.get('Comfy.Desktop.CloudNotificationShown')) {
      const dialogService = useDialogService()
      cloudNotificationTimer = setTimeout(async () => {
        try {
          await dialogService.showCloudNotification()
        } catch (e) {
          console.warn('[CloudNotification] Failed to show', e)
        }
        await settingStore.set('Comfy.Desktop.CloudNotificationShown', true)
      }, 2000)
    }
  }
})

let cloudNotificationTimer: ReturnType<typeof setTimeout> | undefined
onUnmounted(() => {
  if (cloudNotificationTimer) clearTimeout(cloudNotificationTimer)
  window.removeEventListener('vite:preloadError', handlePreloadError)
})
</script>
