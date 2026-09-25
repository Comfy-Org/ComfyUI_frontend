import {
  computed,
  onMounted,
  onScopeDispose,
  ref,
  shallowRef,
  watch
} from 'vue'

import type { Take } from '../lib/workshop/cinematic-studio/reel'
import { removeCinematicJournal } from '../lib/workshop/cinematic-studio/journal'
import type { SavedCreation } from '../lib/workshop/cinematic-studio/creations'
import {
  listCreations,
  saveCreation,
  deleteCreation,
  renameCreation,
  favoriteCreation
} from '../lib/workshop/cinematic-studio/creations'

export function useCinematicLibrary(
  scope: () => string | undefined,
  takes: () => readonly Take[]
) {
  const items = shallowRef<readonly SavedCreation[]>([])
  const loading = ref(false)
  const error = ref(false)
  const urls = shallowRef<Readonly<Record<string, string>>>({})
  const attempted = new Set<string>()
  const attemptedOutputs = new Map<
    string,
    Extract<Take, { status: 'done' }>['output']
  >()
  const deleted = new Set<string>()
  let epoch = 0
  let disposed = false
  const available = computed(
    () => typeof indexedDB !== 'undefined' && !!scope()
  )

  onMounted(() => {
    if (typeof indexedDB === 'undefined') error.value = true
  })
  const isCurrent = (current: number) => current === epoch && !disposed

  function release() {
    Object.values(urls.value).forEach((url) => URL.revokeObjectURL(url))
    urls.value = {}
  }

  async function refresh() {
    const namespace = scope()
    if (!namespace || !available.value) return
    const current = epoch
    loading.value = true
    try {
      const saved = await listCreations(namespace)
      if (disposed || current !== epoch) return
      const next: Record<string, string> = {}
      for (const item of saved)
        next[item.id] = urls.value[item.id] ?? URL.createObjectURL(item.blob)
      for (const [id, url] of Object.entries(urls.value))
        if (!next[id]) URL.revokeObjectURL(url)
      urls.value = next
      items.value = saved
      for (const item of saved) removeCinematicJournal(namespace, item.takeId)
    } catch {
      if (isCurrent(current)) error.value = true
    } finally {
      if (isCurrent(current)) loading.value = false
    }
  }

  async function persist(
    take: Extract<Take, { status: 'done' }>,
    namespace: string
  ) {
    const current = epoch
    if (take.output.kind !== 'image' && take.output.kind !== 'video') return
    try {
      const response = await fetch(take.output.url)
      if (!response.ok) throw new Error('Media unavailable')
      const blob = await response.blob()
      if (disposed || current !== epoch) return
      await saveCreation(namespace, {
        id: take.id,
        takeId: take.id,
        name: take.prompt.slice(0, 80),
        modelSlug: take.modelSlug,
        prompt: take.prompt,
        aspect: take.aspect,
        createdAt: take.startedAt,
        fileName: take.output.fileName,
        kind: take.output.kind,
        nsfw: !!take.output.nsfw,
        blob,
        settings: take.settings
      })
      removeCinematicJournal(namespace, take.id)
      if (isCurrent(current)) await refresh()
    } catch {
      if (isCurrent(current)) error.value = true
    }
  }

  function savePending() {
    const namespace = scope()
    if (!namespace || !available.value) return
    for (const take of takes()) {
      if (
        take.status !== 'done' ||
        (attempted.has(take.id) &&
          attemptedOutputs.get(take.id) === take.output) ||
        deleted.has(take.id)
      )
        continue
      attempted.add(take.id)
      attemptedOutputs.set(take.id, take.output)
      void persist(take, namespace)
    }
  }

  watch(
    scope,
    () => {
      epoch += 1
      release()
      items.value = []
      attempted.clear()
      attemptedOutputs.clear()
      error.value = typeof indexedDB === 'undefined'
      void refresh().then(savePending)
    },
    { immediate: true }
  )
  watch(takes, savePending)

  async function change(action: (namespace: string) => Promise<unknown>) {
    const namespace = scope()
    if (!namespace) return
    const current = epoch
    try {
      await action(namespace)
      if (isCurrent(current)) await refresh()
    } catch {
      if (isCurrent(current)) error.value = true
    }
  }

  function retry() {
    error.value = typeof indexedDB === 'undefined'
    attempted.clear()
    for (const item of items.value) attempted.add(item.id)
    void refresh().then(savePending)
  }

  onScopeDispose(() => {
    disposed = true
    epoch += 1
    release()
  })
  return {
    items,
    urls,
    loading,
    error,
    available,
    retry,
    remove: (id: string) =>
      change(async (namespace) => {
        await deleteCreation(namespace, id)
        deleted.add(id)
      }),
    rename: (id: string, name: string) =>
      change((namespace) => renameCreation(namespace, id, name)),
    favorite: (id: string, value: boolean) =>
      change((namespace) => favoriteCreation(namespace, id, value))
  }
}
