import type { MaybeRef } from 'vue'

export interface PagedList<T> {
  hasMore: Readonly<MaybeRef<boolean>>
  invalidate: (items?: string[]) => Promise<void>
  isLoading: Readonly<MaybeRef<boolean>>
  items: Readonly<MaybeRef<T[]>>
  loadMore: () => Promise<void>
  loadNew: () => Promise<void>
}
