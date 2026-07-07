import { ref } from 'vue'

export interface CloudAsset {
  id: string
  name: string
  url: string
}

export interface UseCloudAssetsOptions {
  // Host-injected fetch of the user's recent cloud assets (history + input).
  fetchAssets: () => Promise<CloudAsset[]>
  // Newest N kept for the tray (monolith parity: deduped, max 24).
  max?: number
}

export function useCloudAssets(options: UseCloudAssetsOptions) {
  const assets = ref<CloudAsset[]>([])
  const loading = ref(false)

  async function load(): Promise<void> {
    loading.value = true
    try {
      const seen = new Set<string>()
      const deduped: CloudAsset[] = []
      for (const asset of await options.fetchAssets()) {
        if (seen.has(asset.id)) continue
        seen.add(asset.id)
        deduped.push(asset)
      }
      assets.value = deduped.slice(0, options.max ?? 24)
    } finally {
      loading.value = false
    }
  }

  return { assets, loading, load }
}
