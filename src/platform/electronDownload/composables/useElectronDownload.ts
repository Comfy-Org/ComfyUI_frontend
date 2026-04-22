import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { useElectronDownloadStore } from '@/stores/electronDownloadStore'

export function useElectronDownload(url: MaybeRefOrGetter<string | undefined>) {
  const store = useElectronDownloadStore()

  const download = computed(() => {
    const value = toValue(url)
    return value ? store.findByUrl(value) : undefined
  })

  const withUrl = (action: (url: string) => unknown) => () => {
    const value = toValue(url)
    if (value) action(value)
  }

  return {
    download,
    pause: withUrl(store.pause),
    resume: withUrl(store.resume),
    cancel: withUrl(store.cancel),
    remove: withUrl(store.remove)
  }
}
