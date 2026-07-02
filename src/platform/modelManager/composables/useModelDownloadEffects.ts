import { watch } from 'vue'

import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useModelStore } from '@/stores/modelStore'

import { useModelDownloadStore } from '../stores/modelDownloadStore'

/**
 * Side effects that run when a server-side download finishes: refresh the
 * affected model folder so the file is recognized, and re-scan missing models
 * so node errors for the now-present model clear automatically.
 *
 * Mounted once at the app root so it runs regardless of whether the Model
 * Manager panel is open.
 */
export function useModelDownloadEffects() {
  const store = useModelDownloadStore()

  watch(
    () => store.lastCompletedDownload,
    async (completed) => {
      if (!completed) return

      if (completed.directory) {
        try {
          await useModelStore().refreshModelFolder(completed.directory)
        } catch (error) {
          console.warn(
            '[ModelManager] Failed to refresh model folder after download',
            error
          )
        }
      }

      try {
        await useMissingModelStore().refreshMissingModels()
      } catch (error) {
        console.warn(
          '[ModelManager] Failed to re-scan missing models after download',
          error
        )
      }
    }
  )
}
