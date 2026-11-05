import { splitOnSeparators, toRepoName } from '@/utils/searchQueryUtil'

const LEGACY_MANAGER_PACK_NAMES: ReadonlySet<string> = new Set([
  'comfyui manager',
  'manager comfyui'
])

export function isLegacyManagerQuery(query: string): boolean {
  return LEGACY_MANAGER_PACK_NAMES.has(
    splitOnSeparators(toRepoName(query).toLowerCase())
  )
}
