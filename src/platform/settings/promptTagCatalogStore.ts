import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

import type { WidgetAugmentationTarget } from '@/platform/extensions/widgetAugmentation'

export function supportsPromptTagCatalog(
  target: WidgetAugmentationTarget | undefined
): boolean {
  return target?.nodeType === 'CLIPTextEncode' && target.widgetName === 'text'
}

function readCatalogFields(line: string) {
  const fields = line.match(/^(?:"((?:[^"]|"")*)"|([^",]+))(?:,(.*))?$/)
  if (!fields) return undefined
  const name = (fields.at(1) ?? fields.at(2) ?? '')
    .replaceAll('""', '"')
    .replaceAll('_', ' ')
    .trim()
  const columns = fields.at(3)?.split(',') ?? []
  const frequency = columns.at(columns.length > 1 ? 1 : 0)
  return { name, frequency: frequency?.replace(/^"(.*)"$/, '$1') }
}

function parseCatalogLine(
  line: string
): { name: string; count: number } | 'header' | undefined {
  const fields = readCatalogFields(line)
  if (!fields) return undefined
  const { name, frequency } = fields
  if (
    ['name', 'tag'].includes(name) &&
    ['count', 'post_count'].includes(frequency ?? '')
  )
    return 'header'
  const count = frequency === undefined ? 0 : Number(frequency)
  if (!name || !Number.isFinite(count) || count < 0) return undefined
  return { name, count }
}

export const usePromptTagCatalogStore = defineStore('promptTagCatalog', () => {
  const tags = shallowRef<readonly string[]>([])

  function importCatalog(text: string): boolean {
    const entries = new Map<string, number>()
    for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
      if (!line.trim()) continue
      const tag = parseCatalogLine(line)
      if (!tag) return false
      if (tag === 'header') {
        if (entries.size > 0) return false
        continue
      }
      entries.set(tag.name, Math.max(tag.count, entries.get(tag.name) ?? 0))
    }
    if (!entries.size) return false
    tags.value = [...entries].sort((a, b) => b[1] - a[1]).map(([name]) => name)
    return true
  }

  function suggest(query: string): string[] {
    const search = query.toLowerCase().replaceAll('_', ' ')
    const prefix: string[] = []
    const substring: string[] = []
    for (const tag of tags.value) {
      const normalized = tag.toLowerCase()
      if (normalized === search) continue
      if (normalized.startsWith(search)) prefix.push(tag)
      else if (substring.length < 8 && normalized.includes(search))
        substring.push(tag)
      if (prefix.length === 8) break
    }
    return [...prefix, ...substring].slice(0, 8)
  }

  return { tags, importCatalog, suggest }
})
