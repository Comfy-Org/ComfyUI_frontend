import { Semaphore } from 'es-toolkit'

import { t } from '@/i18n'
import type {
  ComfyFileRef,
  FileModality,
  MediaItem
} from '@/renderer/extensions/superComfy/engine/documentSchema'
import { api } from '@/scripts/api'
import { uploadInputFile } from '@/services/uploadTempFile'
import type { ComfyFileUpload } from '@/services/uploadTempFile'
import { createAnnotatedPath } from '@/utils/createAnnotatedPath'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'
import type { AugmentedResultItem } from '@/utils/resultItem'
import { resultItemPreviewUrl, resultItemUrl } from '@/utils/resultItemUrl'

type MediaOutcome<T> = ({ ok: true } & T) | { ok: false; reason: string }

const UPLOAD_SUBFOLDER = 'supercomfy'
const PARALLEL_UPLOADS = 3

const RESULT_MEDIA_TYPE: Record<FileModality, string> = {
  image: 'images',
  video: 'video',
  audio: 'audio',
  '3d': '3D'
}

const FILENAME_MEDIA_TYPE: Record<FileModality, string> = {
  image: 'image',
  video: 'video',
  audio: 'audio',
  '3d': '3D'
}

const ACCEPT: Record<FileModality, string> = {
  image: 'image/*',
  video: 'video/*',
  audio: 'audio/*',
  '3d': '.obj,.fbx,.gltf,.glb,.stl,.usdz,.ply,.spz,.splat,.ksplat'
}

function fileResultItem(
  ref: ComfyFileRef,
  modality: FileModality
): AugmentedResultItem {
  return {
    filename: ref.filename,
    subfolder: ref.subfolder,
    type: ref.type,
    mediaType: RESULT_MEDIA_TYPE[modality],
    nodeId: ''
  }
}

function viewRoute(ref: ComfyFileRef): string {
  const params = new URLSearchParams({
    filename: ref.filename,
    type: ref.type,
    subfolder: ref.subfolder
  })
  return `/view?${params}`
}

export function toResultItem(item: MediaItem): AugmentedResultItem {
  switch (item.kind) {
    case 'file':
      return fileResultItem(item.ref, item.modality)
    case 'link':
      return {
        filename: '',
        subfolder: '',
        mediaType: RESULT_MEDIA_TYPE[item.modality],
        nodeId: '',
        url: item.url,
        previewUrl: item.url
      }
    case 'text':
      return {
        filename: '',
        subfolder: '',
        mediaType: 'text',
        nodeId: '',
        content: item.text
      }
  }
}

export function itemViewUrl(item: MediaItem): string {
  return resultItemUrl(toResultItem(item))
}

export function itemPreviewUrl(item: MediaItem): string {
  return resultItemPreviewUrl(toResultItem(item))
}

export function toLoaderValue(
  item: Extract<MediaItem, { kind: 'file' }>
): string {
  return createAnnotatedPath(item.ref)
}

export function acceptFor(modality: FileModality): string {
  return ACCEPT[modality]
}

function fileMatchesModality(file: File, modality: FileModality): boolean {
  if (modality !== '3d' && file.type.startsWith(`${modality}/`)) return true
  return getMediaTypeFromFilename(file.name) === FILENAME_MEDIA_TYPE[modality]
}

async function fetchBlob(
  request: () => Promise<Response>
): Promise<{ ok: true; blob: Blob } | { ok: false; reason: 'unreadable' }> {
  try {
    const response = await request()
    if (!response.ok) return { ok: false, reason: 'unreadable' }
    return { ok: true, blob: await response.blob() }
  } catch {
    return { ok: false, reason: 'unreadable' }
  }
}

export async function readItemBytes(
  item: MediaItem,
  signal: AbortSignal
): Promise<
  { ok: true; blob: Blob } | { ok: false; reason: 'unreadable' | 'expired' }
> {
  switch (item.kind) {
    case 'text':
      return { ok: true, blob: new Blob([item.text], { type: 'text/plain' }) }
    case 'link':
      if (item.expiresAt <= Date.now()) return { ok: false, reason: 'expired' }
      return fetchBlob(() => fetch(item.url, { signal }))
    case 'file':
      return fetchBlob(() => api.fetchApi(viewRoute(item.ref), { signal }))
  }
}

function toFileItem(
  upload: ComfyFileUpload,
  modality: FileModality,
  mime: string
): MediaOutcome<{ item: MediaItem }> {
  if (!upload.ok) return upload
  const filename = upload.file.name
  if (!filename) return { ok: false, reason: t('superComfy.media.unreadable') }
  return {
    ok: true,
    item: {
      kind: 'file',
      modality,
      ref: {
        filename,
        subfolder: upload.file.subfolder ?? '',
        type: 'input'
      },
      ...(mime ? { mime } : {})
    }
  }
}

async function uploadWithin(
  semaphore: Semaphore,
  file: File,
  modality: FileModality
): Promise<MediaOutcome<{ item: MediaItem }>> {
  await semaphore.acquire()
  try {
    const upload = await uploadInputFile(file, UPLOAD_SUBFOLDER)
    return toFileItem(upload, modality, file.type)
  } finally {
    semaphore.release()
  }
}

export async function uploadMediaFiles(
  files: readonly File[],
  modality: FileModality
): Promise<MediaOutcome<{ items: MediaItem[] }>> {
  const accepted = files.filter((file) => fileMatchesModality(file, modality))
  if (accepted.length === 0) {
    return { ok: false, reason: t('superComfy.media.wrongType') }
  }
  const semaphore = new Semaphore(PARALLEL_UPLOADS)
  const outcomes = await Promise.all(
    accepted.map((file) => uploadWithin(semaphore, file, modality))
  )
  const failure = outcomes.find(
    (outcome): outcome is { ok: false; reason: string } => !outcome.ok
  )
  if (failure) return failure
  return {
    ok: true,
    items: outcomes.flatMap((outcome) => (outcome.ok ? [outcome.item] : []))
  }
}

export async function persistBlob(
  blob: Blob,
  name: string,
  modality: FileModality
): Promise<MediaOutcome<{ item: MediaItem }>> {
  const file = new File([blob], name, { type: blob.type })
  const upload = await uploadInputFile(file, UPLOAD_SUBFOLDER)
  return toFileItem(upload, modality, blob.type)
}
