import type { SearchAttribute } from '@/types/algoliaTypes'

export const SEARCH_CACHE_MAX_SIZE = 64
export const DEFAULT_PAGE_SIZE = 64
export const MIN_CHARS_FOR_SUGGESTIONS_ALGOLIA = 2
export const USER_SEARCH_ANALYTICS_TAG = 'user'
export const PACK_SEARCHABLE_ATTRIBUTES: readonly SearchAttribute[] = [
  'name',
  'description'
]
