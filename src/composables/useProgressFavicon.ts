import { useFavicon } from '@vueuse/core'
import { type WatchHandle, ref, watch } from 'vue'

import { useExecutionStore } from '@/stores/executionStore'
import { useSettingStore } from '@/stores/settingStore'

export const useProgressFavicon = () => {
  const defaultFavicon = '/assets/images/favicon_progress_16x16/frame_9.png'
  const favicon = useFavicon(defaultFavicon)
  const executionStore = useExecutionStore()
  const settingsStore = useSettingStore()
  const totalFrames = 10

  const watchHandle = ref<WatchHandle>()

  function watchProgress() {
    watchHandle.value = watch(
      [() => executionStore.executionProgress, () => executionStore.isIdle],
      ([progress, isIdle]) => {
        if (isIdle) {
          favicon.value = defaultFavicon
        } else {
          const frame = Math.floor(progress * totalFrames)
          favicon.value = `/assets/images/favicon_progress_16x16/frame_${frame}.png`
        }
      }
    )
  }

  watch(
    () => settingsStore.get('Comfy.Window.TabIconProgress'),
    (showProgress) => {
      if (showProgress) {
        watchProgress()
      } else {
        watchHandle.value?.stop()
      }
    },
    { immediate: true }
  )
}
