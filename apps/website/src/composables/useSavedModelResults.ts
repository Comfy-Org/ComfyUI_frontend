import { onScopeDispose, ref, shallowRef, watch } from 'vue'
import {
  deleteModelResult,
  listModelResults
} from '../lib/workshop/cinematic-studio/model-results'
import type { ModelResult } from '../lib/workshop/cinematic-studio/model-results'

export function useSavedModelResults(scope: () => string | undefined) {
  const items = shallowRef<readonly ModelResult[]>([])
  const urls = shallowRef<Readonly<Record<string, readonly string[]>>>({})
  const loading = ref(false)
  const error = ref(false)
  let epoch = 0

  function release() {
    Object.values(urls.value)
      .flat()
      .forEach((url) => URL.revokeObjectURL(url))
    urls.value = {}
  }

  async function refresh() {
    const namespace = scope()
    const current = ++epoch
    if (!namespace) return
    loading.value = true
    error.value = false
    try {
      const saved = await listModelResults(namespace)
      if (current !== epoch) return
      release()
      urls.value = Object.fromEntries(
        saved.map((item) => [
          item.id,
          item.outputs.map((output) => URL.createObjectURL(output.blob))
        ])
      )
      items.value = saved
    } catch {
      if (current === epoch) error.value = true
    } finally {
      if (current === epoch) loading.value = false
    }
  }

  async function remove(id: string) {
    const namespace = scope()
    if (!namespace) return
    const current = epoch
    try {
      await deleteModelResult(namespace, id)
      if (current === epoch) await refresh()
    } catch {
      if (current === epoch) error.value = true
    }
  }

  watch(
    scope,
    () => {
      epoch += 1
      release()
      items.value = []
      loading.value = false
      error.value = false
      void refresh()
    },
    { immediate: true }
  )
  onScopeDispose(() => {
    epoch += 1
    release()
  })
  return { items, urls, loading, error, refresh, remove }
}
