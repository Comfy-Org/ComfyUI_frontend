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
          const id = draft[mode].referenceBundleId
          const before = options.files()[mode]
          let files: readonly ReferenceFile[] = []
          let missing = !id && !!draft[mode].references?.length
          if (missing) options.error('read')
          if (id) {
            try {
              files = await loadReferenceBundle(scope, id)
            } catch {
              missing = true
              if (current === epoch) options.error('read')
            }
          }
          if (current !== epoch) return
          if (sameFiles(before, options.files()[mode])) {
            options.applyFiles(mode, files, draft)
            cache[mode] = {
              files: options.files()[mode],
              id,
              ...(missing ? { missing: draft[mode] } : {})
            }
          }
        }
      }
      if (current === epoch) writable = true
    } catch {
      if (current === epoch) options.error('read')
    } finally {
      if (current === epoch) {
        hydrating.value = false
        void persist()
      }
    }
  }
  async function persist() {
    const scope = options.namespace()
    if (!mounted || !writable || hydrating.value || !scope) return
    const current = epoch
    const change = ++revision
    try {
      const draft = parseComposerDrafts(serializeComposerDrafts(options.read()))
      const files = options.files()
      for (const mode of modes) {
        const cached = cache[mode]
        let id = cached?.id
        if (cached?.missing && sameFiles(cached.files, files[mode])) {
          draft[mode].assets = cached.missing.assets
          draft[mode].references = cached.missing.references
        }
        if (!cached || !sameFiles(cached.files, files[mode])) {
          id = files[mode].length
            ? await saveReferenceBundle(scope, files[mode])
            : undefined
          if (current !== epoch || change !== revision) return
          cache[mode] = { files: files[mode], id }
        }
        draft[mode].referenceBundleId = id
      }
      if (
        current !== epoch ||
        change !== revision ||
        scope !== options.namespace()
      )
        return
      localStorage.setItem(
        composerDraftKey(scope),
        serializeComposerDrafts(draft)
      )
    } catch {
      if (current === epoch && change === revision) options.error('write')
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
