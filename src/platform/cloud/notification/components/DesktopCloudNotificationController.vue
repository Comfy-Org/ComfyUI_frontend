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

function reportNotificationFailure(
  errorType:
    | 'cloud_notification_state_save_failed'
    | 'cloud_notification_show_failed'
    | 'cloud_notification_state_reset_failed',
  operation: 'save' | 'render',
  cause: unknown,
  platform: string
) {
  reportError(cause, {
    errorType,
    tags: {
      failure_kind: 'caught_unexpected',
      feature_area: 'cloud',
      operation,
      outcome: 'failed',
      assert_mode: 'soft'
    },
    context: { platform, is_disposed: isDisposed },
    level: 'error'
  })
}

async function resetNotificationState(platform: string) {
  try {
    await settingStore.set('Comfy.Desktop.CloudNotificationShown', false)
  } catch (error) {
    reportNotificationFailure(
      'cloud_notification_state_reset_failed',
      'save',
      error,
      platform
    )
  }
}

async function scheduleCloudNotification() {
  const platform = electronAPI()?.getPlatform()
  if (!isDesktop || platform !== 'darwin') return

  await settingStore.load()
  if (settingStore.error !== undefined) return
  if (isDisposed) return
  if (settingStore.get('Comfy.Desktop.CloudNotificationShown')) return

  cloudNotificationTimer = setTimeout(async () => {
    if (isDisposed) return

    try {
      await settingStore.set('Comfy.Desktop.CloudNotificationShown', true)
    } catch (error) {
      reportNotificationFailure(
        'cloud_notification_state_save_failed',
        'save',
        error,
        platform
      )
      await resetNotificationState(platform)
      return
    }

    if (isDisposed) {
      await resetNotificationState(platform)
      return
    }

    try {
      await dialogService.showCloudNotification()
    } catch (error) {
      reportNotificationFailure(
        'cloud_notification_show_failed',
        'render',
        error,
        platform
      )
      await resetNotificationState(platform)
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
