import { onMounted, onScopeDispose, ref, watch } from 'vue'
import {
  composerDraftKey,
  parseComposerDrafts,
  serializeComposerDrafts
} from '../lib/workshop/cinematic-studio/composer-drafts'
import type { ComposerDrafts } from '../lib/workshop/cinematic-studio/composer-drafts'
import {
  loadReferenceBundle,
  saveReferenceBundle
} from '../lib/workshop/cinematic-studio/reference-bundles'
import type { ReferenceFile } from '../lib/workshop/cinematic-studio/reference-bundles'

type Mode = 'image' | 'video'
type Files = Record<Mode, readonly ReferenceFile[]>
const modes: readonly Mode[] = ['image', 'video']
const sameFiles = (
  left: readonly ReferenceFile[],
  right: readonly ReferenceFile[]
) =>
  left.length === right.length &&
  left.every(
    (item, index) =>
      item.file === right[index].file &&
      item.role === right[index].role &&
      item.assetId === right[index].assetId
  )

export function useCinematicComposerDrafts(options: {
  namespace: () => string | undefined
  read: () => ComposerDrafts
  files: () => Files
  reset: () => void
  apply: (draft: ComposerDrafts) => void
  applyFiles: (
    mode: Mode,
    files: readonly ReferenceFile[],
    draft: ComposerDrafts
  ) => void
  error: (kind: 'read' | 'write') => void
}) {
  const hydrating = ref(true)
  let mounted = false
  let epoch = 0
  let revision = 0
  let writable = false
  let cache: Partial<
    Record<
      Mode,
      {
        files: readonly ReferenceFile[]
        id?: string
        missing?: ComposerDrafts[Mode]
      }
    >
  > = {}
  function acceptHydratedFiles(
    mode: Mode,
    draft: ComposerDrafts,
    before: readonly ReferenceFile[],
    files: readonly ReferenceFile[],
    missing: boolean
  ) {
    if (!sameFiles(before, options.files()[mode])) return
    options.applyFiles(mode, files, draft)
    cache[mode] = {
      files: options.files()[mode],
      id: draft[mode].referenceBundleId,
      ...(missing ? { missing: draft[mode] } : {})
    }
  }
  function hydrateBundle(
    scope: string,
    id: string,
    mode: Mode,
    draft: ComposerDrafts,
    current: number,
    before: readonly ReferenceFile[]
  ) {
    return loadReferenceBundle(scope, id).then(
      (files) => {
        if (current !== epoch) return false
        acceptHydratedFiles(mode, draft, before, files, false)
        return true
      },
      () => {
        if (current !== epoch) return false
        options.error('read')
        acceptHydratedFiles(mode, draft, before, [], true)
        return true
      }
    )
  }
  function hydrateMode(
    scope: string,
    mode: Mode,
    draft: ComposerDrafts,
    current: number
  ) {
    const id = draft[mode].referenceBundleId
    const before = options.files()[mode]
    const missing = !id && !!draft[mode].references?.length
    if (missing) options.error('read')
    if (id) return hydrateBundle(scope, id, mode, draft, current, before)
    if (current !== epoch) return false
    acceptHydratedFiles(mode, draft, before, [], missing)
    return true
  }
  async function hydrate() {
    const current = ++epoch
    revision++
    hydrating.value = true
    writable = false
    cache = {}
    options.reset()
    const scope = options.namespace()
    if (!scope) {
      hydrating.value = false
      return
    }
    try {
      const json = localStorage.getItem(composerDraftKey(scope))
      if (json) {
        const draft = parseComposerDrafts(json)
        options.apply(draft)
        for (const mode of modes) {
          const hydration = hydrateMode(scope, mode, draft, current)
          if (!(hydration instanceof Promise ? await hydration : hydration))
            return
        }
      }
      if (current === epoch) writable = true
    } catch {
      if (current === epoch) options.error('read')
    } finally {
      finishHydration(current)
    }
  }
  function finishHydration(current: number) {
    if (current !== epoch) return
    hydrating.value = false
    void persist()
  }
  function currentWrite(current: number, change: number) {
    return current === epoch && change === revision
  }
  function preserveMissingReceipt(
    mode: Mode,
    draft: ComposerDrafts,
    files: Files
  ) {
    const cached = cache[mode]
    if (cached?.missing && sameFiles(cached.files, files[mode])) {
      draft[mode].assets = cached.missing.assets
      draft[mode].references = cached.missing.references
    }
  }
  function persistMode(
    scope: string,
    mode: Mode,
    draft: ComposerDrafts,
    files: Files,
    current: number,
    change: number
  ) {
    const cached = cache[mode]
    let id = cached?.id
    preserveMissingReceipt(mode, draft, files)
    if (!cached || !sameFiles(cached.files, files[mode])) {
      if (files[mode].length)
        return saveReferenceBundle(scope, files[mode]).then((savedId) => {
          if (!currentWrite(current, change)) return false
          cache[mode] = { files: files[mode], id: savedId }
          draft[mode].referenceBundleId = savedId
          return true
        })
      id = undefined
      if (!currentWrite(current, change)) return false
      cache[mode] = { files: files[mode], id }
    }
    draft[mode].referenceBundleId = id
    return true
  }
  function canPersist() {
    return mounted && writable && !hydrating.value
  }
  function publishDraft(
    scope: string,
    draft: ComposerDrafts,
    current: number,
    change: number
  ) {
    if (!currentWrite(current, change) || scope !== options.namespace()) return
    localStorage.setItem(
      composerDraftKey(scope),
      serializeComposerDrafts(draft)
    )
  }
  async function persist() {
    const scope = options.namespace()
    if (!canPersist() || !scope) return
    const current = epoch
    const change = ++revision
    try {
      const draft = parseComposerDrafts(serializeComposerDrafts(options.read()))
      const files = options.files()
      for (const mode of modes) {
        const persistence = persistMode(
          scope,
          mode,
          draft,
          files,
          current,
          change
        )
        if (!(persistence instanceof Promise ? await persistence : persistence))
          return
      }
      publishDraft(scope, draft, current, change)
    } catch {
      if (currentWrite(current, change)) options.error('write')
    }
  }
  watch(
    () => [options.read(), options.files()],
    () => {
      void persist()
    },
    { deep: true }
  )
  watch(
    options.namespace,
    () => {
      if (mounted) void hydrate()
    },
    { flush: 'sync' }
  )
  onMounted(() => {
    mounted = true
    void hydrate()
  })
  onScopeDispose(() => {
    mounted = false
    epoch++
    revision++
  })
  return { hydrating, persist }
}
