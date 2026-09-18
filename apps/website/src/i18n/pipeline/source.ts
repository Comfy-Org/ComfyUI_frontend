import { translationTargets } from '@comfyorg/comfyui-frontend/scripts/i18n/config'
import type { SourceEntry } from './types'

export function translatableEntries(entries: SourceEntry[]): SourceEntry[] {
  return entries.filter(
    ({ key }) =>
      !translationTargets.website.excludedKeyPrefixes?.some(
        (prefix) => key === prefix || key.startsWith(`${prefix}.`)
      )
  )
}
