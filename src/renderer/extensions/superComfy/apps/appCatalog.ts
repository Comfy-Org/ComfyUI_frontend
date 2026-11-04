import { ref } from 'vue'
import type { Ref } from 'vue'

export interface AppCatalogEntry {
  path: string
  title: string
  lastModified: number
}

export function useAppCatalog(): {
  apps: Readonly<Ref<AppCatalogEntry[]>>
  loading: Readonly<Ref<boolean>>
  refresh(): Promise<void>
} {
  return {
    apps: ref<AppCatalogEntry[]>([]),
    loading: ref(false),
    refresh: () => Promise.resolve()
  }
}
