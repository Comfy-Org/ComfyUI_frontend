import { computed, ref, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { ComfyModelDef } from '@/stores/modelStore'
import { useModelStore } from '@/stores/modelStore'

// Local "Model Library" data source for desktop/localhost distributions. Wraps
// the legacy useModelStore (which lists folders via /models and files via
// /models/{folder}) and adapts each ComfyModelDef into the AssetItem shape so
// the existing cloud library UI can render local files without forking.
//
// AssetItem shape mapping:
//   id          local:<directory>/<file_name>           (stable, collision-safe)
//   name        normalized file_name (path within folder, e.g. sdxl/foo)
//   display_name  leaf filename without .safetensors
//   tags        ['models', <directory>]                  (drives category grouping)
//   metadata    { filepath, directory, path_index }      (used downstream)
//
// Cloud-only fields like preview_url, base_model, repo_id stay undefined until
// the enrichment layers (sibling image / safetensors header / Civitai) land.

function adaptModelToAsset(model: ComfyModelDef): AssetItem {
  const filepath = `${model.directory}/${model.normalized_file_name}`
  const tags = ['models', model.directory]
  for (const t of model.tags) {
    if (t && !tags.includes(t)) tags.push(t)
  }
  const id = `local:${filepath}`
  return {
    id,
    name: model.normalized_file_name,
    display_name:
      model.title?.trim() ||
      model.simplified_file_name ||
      model.normalized_file_name,
    tags,
    is_immutable: false,
    metadata: {
      filepath,
      directory: model.directory,
      path_index: model.path_index,
      base_model: model.architecture_id || undefined,
      author: model.author || undefined,
      description: model.description || undefined,
      trigger_phrase: model.trigger_phrase || undefined,
      resolution: model.resolution || undefined,
      usage_hint: model.usage_hint || undefined,
      preview_image: model.image || undefined
    }
  }
}

export interface LocalModelLibrarySource {
  assets: ComputedRef<AssetItem[]>
  isLoading: Ref<boolean>
  refresh: () => Promise<void>
}

// Module-level shared state so calling useLocalModelLibrarySource() from
// multiple sites (sidebar tab, widget picker, etc.) shares one fetch lifecycle
// instead of clobbering useModelStore's folder map on each call.
let cached: LocalModelLibrarySource | null = null

export function useLocalModelLibrarySource(): LocalModelLibrarySource {
  if (cached) return cached

  const modelStore = useModelStore()
  const isLoading = ref(false)
  // ComfyModelDef fields are mutated on plain class instances after load() —
  // Vue can't reliably observe that. Bumping enrichmentTick after each load
  // forces the assets computed to re-read the (now-populated) fields.
  const enrichmentTick = ref(0)
  let inflight: Promise<void> | null = null

  async function refresh(): Promise<void> {
    if (inflight) return inflight
    isLoading.value = true
    inflight = (async () => {
      try {
        await modelStore.loadModelFolders()
        await modelStore.loadModels()
      } finally {
        isLoading.value = false
        inflight = null
      }
    })()
    return inflight
  }

  void refresh()

  const assets = computed<AssetItem[]>(() => {
    // Touch the tick so this recomputes when new metadata lands.
    void enrichmentTick.value
    return modelStore.models.map(adaptModelToAsset)
  })

  // Trigger per-file safetensors metadata loading lazily. After each load
  // resolves we bump enrichmentTick so the computed picks up the new fields.
  watch(
    () => modelStore.models.length,
    () => {
      for (const m of modelStore.models) {
        if (!m.has_loaded_metadata && !m.is_load_requested) {
          void m.load().then(() => {
            enrichmentTick.value++
          })
        }
      }
    },
    { immediate: true }
  )

  cached = { assets, isLoading, refresh }
  return cached
}
