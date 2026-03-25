<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

import { isDesktop } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useDialogService } from '@/services/dialogService'
import { electronAPI } from '@/utils/envUtil'

const settingStore = useSettingStore()
const dialogService = useDialogService()

let cloudNotificationTimer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  if (!isDesktop || electronAPI()?.getPlatform() !== 'darwin') return

  void (async () => {
    try {
      await settingStore.load()
    } catch (error) {
      console.warn('[CloudNotification] Failed to load settings', error)
      return
    }

    if (settingStore.get('Comfy.Desktop.CloudNotificationShown')) return

    cloudNotificationTimer = setTimeout(async () => {
      try {
        await settingStore.set('Comfy.Desktop.CloudNotificationShown', true)
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
  })()
})

onUnmounted(() => {
  if (cloudNotificationTimer) clearTimeout(cloudNotificationTimer)
})
</script>
