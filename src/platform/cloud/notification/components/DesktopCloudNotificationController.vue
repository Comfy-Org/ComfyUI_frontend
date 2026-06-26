<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

import { isDesktop } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useDialogService } from '@/services/dialogService'
import { electronAPI } from '@/utils/envUtil'

const settingStore = useSettingStore()
const dialogService = useDialogService()

let isDisposed = false
let cloudNotificationTimer: ReturnType<typeof setTimeout> | undefined

async function scheduleCloudNotification() {
  if (!isDesktop || electronAPI()?.getPlatform() !== 'darwin') return

  try {
    await settingStore.load()
  } catch (error) {
    console.warn('[CloudNotification] Failed to load settings', error)
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
      console.warn('[CloudNotification] Failed to show', error)
      await settingStore
        .set('Comfy.Desktop.CloudNotificationShown', false)
        .catch((resetError) => {
          console.warn(
            '[CloudNotification] Failed to reset shown state',
            resetError
          )
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
