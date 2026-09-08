<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

import { isDesktop } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { reportError } from '@/platform/telemetry/reportError'
import { useDialogService } from '@/services/dialogService'
import { electronAPI } from '@/utils/envUtil'

const settingStore = useSettingStore()
const dialogService = useDialogService()

let isDisposed = false
let cloudNotificationTimer: ReturnType<typeof setTimeout> | undefined

async function scheduleCloudNotification() {
  const platform = electronAPI()?.getPlatform()
  if (!isDesktop || platform !== 'darwin') return

  try {
    await settingStore.load()
  } catch (error) {
    reportError(error, {
      errorType: 'cloud_notification_settings_load_failed',
      tags: {
        failure_kind: 'caught_unexpected',
        feature_area: 'cloud',
        operation: 'load',
        outcome: 'failed',
        assert_mode: 'soft'
      },
      context: { platform, is_disposed: isDisposed },
      level: 'error'
    })
    return
  }

  if (isDisposed) return
  if (settingStore.get('Comfy.Desktop.CloudNotificationShown')) return

  cloudNotificationTimer = setTimeout(async () => {
    if (isDisposed) return

    try {
      await settingStore.set('Comfy.Desktop.CloudNotificationShown', true)
      if (isDisposed) return
      await dialogService.showCloudNotification()
    } catch (error) {
      reportError(error, {
        errorType: 'cloud_notification_show_failed',
        tags: {
          failure_kind: 'caught_unexpected',
          feature_area: 'cloud',
          operation: 'render',
          outcome: 'failed',
          assert_mode: 'soft'
        },
        context: { platform, is_disposed: isDisposed },
        level: 'error'
      })
      await settingStore
        .set('Comfy.Desktop.CloudNotificationShown', false)
        .catch((resetError) => {
          reportError(resetError, {
            errorType: 'cloud_notification_state_reset_failed',
            tags: {
              failure_kind: 'caught_unexpected',
              feature_area: 'cloud',
              operation: 'save',
              outcome: 'failed',
              assert_mode: 'soft'
            },
            context: { platform, is_disposed: isDisposed },
            level: 'error'
          })
        })
    }
  }, 2000)
}

onMounted(() => {
  void scheduleCloudNotification()
})

onUnmounted(() => {
  isDisposed = true
  if (cloudNotificationTimer) clearTimeout(cloudNotificationTimer)
})
</script>
