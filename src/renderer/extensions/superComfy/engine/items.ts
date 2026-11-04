import type { MediaItem } from './documentSchema'
import { stableKey } from './stableKey'

export function itemKey(item: MediaItem): string {
  switch (item.kind) {
    case 'file':
      return `f:${item.ref.type}/${item.ref.subfolder}/${item.ref.filename}`
    case 'link':
      return `l:${item.url}`
    case 'text':
      return `t:${stableKey(item.text)}`
  }
}

export function textItem(text: string): MediaItem {
  return { kind: 'text', text }
}
