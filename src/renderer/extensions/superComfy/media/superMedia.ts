import type {
  FileModality,
  MediaItem
} from '@/renderer/extensions/superComfy/engine/documentSchema'
import { createAnnotatedPath } from '@/utils/createAnnotatedPath'
import type { AugmentedResultItem } from '@/utils/resultItem'

type MediaOutcome<T> = ({ ok: true } & T) | { ok: false; reason: string }

export function toResultItem(item: MediaItem): AugmentedResultItem {
  return {
    filename: item.kind === 'file' ? item.ref.filename : '',
    subfolder: item.kind === 'file' ? item.ref.subfolder : '',
    mediaType: item.kind === 'text' ? 'text' : item.modality,
    nodeId: ''
  }
}

export function itemViewUrl(item: MediaItem): string {
  return item.kind === 'link' ? item.url : ''
}

export function itemPreviewUrl(item: MediaItem): string {
  return itemViewUrl(item)
}

export function toLoaderValue(
  item: Extract<MediaItem, { kind: 'file' }>
): string {
  return createAnnotatedPath(item.ref)
}

export function acceptFor(_modality: FileModality): string {
  return ''
}

export function readItemBytes(
  _item: MediaItem,
  _signal: AbortSignal
): Promise<
  { ok: true; blob: Blob } | { ok: false; reason: 'unreadable' | 'expired' }
> {
  return Promise.resolve({ ok: false, reason: 'unreadable' })
}

export function uploadMediaFiles(
  _files: readonly File[],
  _modality: FileModality
): Promise<MediaOutcome<{ items: MediaItem[] }>> {
  return Promise.resolve({ ok: false, reason: 'unavailable' })
}

export function persistBlob(
  _blob: Blob,
  _name: string,
  _modality: FileModality
): Promise<MediaOutcome<{ item: MediaItem }>> {
  return Promise.resolve({ ok: false, reason: 'unavailable' })
}
