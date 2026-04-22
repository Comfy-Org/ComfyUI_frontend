import { DownloadStatus } from '@comfyorg/comfyui-electron-types'
import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { useElectronDownloadStore } from '@/platform/electronDownload/electronDownloadStore'

/**
 * Classification of the download's current status from a UI-slot perspective:
 * - `none`    — no entry exists for this URL; render the Download action.
 * - `active`  — download is live (pending/in-progress/paused/completed);
 *               render the progress UI.
 * - `stopped` — download finished in a non-success terminal state
 *               (cancelled/error); render the stopped notice.
 *
 * Exposed from the composable so consumers don't have to duplicate the
 * DownloadStatus taxonomy.
 */
export type ElectronDownloadPhase = 'none' | 'active' | 'stopped'

export function useElectronDownload(url: MaybeRefOrGetter<string | undefined>) {
  const store = useElectronDownloadStore()

  const download = computed(() => {
    const value = toValue(url)
    return value ? store.findByUrl(value) : undefined
  })

  const phase = computed<ElectronDownloadPhase>(() => {
    const dl = download.value
    if (!dl) return 'none'
    if (
      dl.status === DownloadStatus.CANCELLED ||
      dl.status === DownloadStatus.ERROR
    ) {
      return 'stopped'
    }
    return 'active'
  })

  const withUrl = (action: (url: string) => unknown) => () => {
    const value = toValue(url)
    if (value) action(value)
  }

  return {
    download,
    phase,
    pause: withUrl(store.pause),
    resume: withUrl(store.resume),
    cancel: withUrl(store.cancel),
    remove: withUrl(store.remove)
  }
}
