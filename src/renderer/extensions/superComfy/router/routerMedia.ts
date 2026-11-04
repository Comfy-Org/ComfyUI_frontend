import { combineAbortSignals } from '@comfyorg/api-client/abortSignal'
import { z } from 'zod'

import { t } from '@/i18n'
import type {
  FileModality,
  MediaItem,
  Modality
} from '@/renderer/extensions/superComfy/engine/documentSchema'
import { itemKey } from '@/renderer/extensions/superComfy/engine/items'
import {
  persistBlob,
  readItemBytes
} from '@/renderer/extensions/superComfy/media/superMedia'
import {
  routerFailureMessage,
  routerFetch
} from '@/renderer/extensions/superComfy/router/routerApi'
import type {
  EncodedMedia,
  RawRouterOutput,
  RouterEncoding
} from '@/renderer/extensions/superComfy/router/routerTypes'
import type { operations } from '@/types/comfyRegistryTypes'

export type EncodeOutcome =
  | { ok: true; value: EncodedMedia }
  | { ok: false; message: string }

export type PersistOutcome =
  | { ok: true; item: MediaItem }
  | { ok: false; message: string }

export type MediaEncoder = (
  item: MediaItem,
  encoding: RouterEncoding,
  signal: AbortSignal
) => Promise<EncodeOutcome>

type StorageRequest =
  operations['createCustomerStorageResource']['requestBody']['content']['application/json']

const zStorageResponse = z.looseObject({
  upload_url: z.string().optional(),
  download_url: z.string().optional(),
  existing_file: z.boolean().optional()
})

const STORAGE_TIMEOUT_MS = 30_000
const TRANSFER_TIMEOUT_MS = 120_000
const LINK_LIFETIME_MS = 23 * 60 * 60 * 1000
const BASE64_CHUNK = 0x8000
const HASH_NAME_LENGTH = 16

const READ_FAILURE_KEYS = {
  unreadable: 'superComfy.media.unreadable',
  expired: 'superComfy.media.expired'
} as const

const EXTENSION_MIME: Readonly<Partial<Record<string, string>>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  glb: 'model/gltf-binary',
  gltf: 'model/gltf+json'
}

const MIME_EXTENSION: Readonly<Partial<Record<string, string>>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
  'audio/mp4': 'm4a',
  'model/gltf-binary': 'glb',
  'model/gltf+json': 'gltf'
}

const FALLBACK_EXTENSION: Record<FileModality, string> = {
  image: 'png',
  video: 'mp4',
  audio: 'mp3',
  '3d': 'glb'
}

function extensionOfName(name: string): string {
  const path = name.split(/[?#]/)[0]
  const dot = path.lastIndexOf('.')
  return dot === -1 ? '' : path.slice(dot + 1).toLowerCase()
}

function mimeOf(blob: Blob, item: Exclude<MediaItem, { kind: 'text' }>) {
  const name = item.kind === 'file' ? item.ref.filename : item.url
  return (
    blob.type ||
    item.mime ||
    EXTENSION_MIME[extensionOfName(name)] ||
    'application/octet-stream'
  )
}

function extensionFor(mime: string, modality: FileModality): string {
  return MIME_EXTENSION[mime.split(';')[0]] ?? FALLBACK_EXTENSION[modality]
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const chunks: string[] = []
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK) {
    chunks.push(
      String.fromCharCode(...bytes.subarray(offset, offset + BASE64_CHUNK))
    )
  }
  return btoa(chunks.join(''))
}

function base64ToBlob(data: string, mime: string): Blob {
  const binary = atob(data)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new Blob([bytes], { type: mime })
}

async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')
}

function uploadFailed(reason: string): { ok: false; message: string } {
  return { ok: false, message: t('superComfy.media.uploadFailed', { reason }) }
}

async function putBytes(
  url: string,
  blob: Blob,
  mime: string,
  signal: AbortSignal
): Promise<string | null> {
  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': mime },
      body: blob,
      signal: combineAbortSignals([
        signal,
        AbortSignal.timeout(TRANSFER_TIMEOUT_MS)
      ])
    })
    return response.ok ? null : response.statusText || String(response.status)
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

async function uploadForRouter(
  blob: Blob,
  mime: string,
  modality: FileModality,
  signal: AbortSignal
): Promise<EncodeOutcome> {
  const hash = await sha256Hex(blob)
  const body: StorageRequest = {
    file_name: `supercomfy-${hash.slice(0, HASH_NAME_LENGTH)}.${extensionFor(mime, modality)}`,
    content_type: mime,
    file_hash: hash
  }
  const response = await routerFetch({
    path: '/customers/storage',
    method: 'POST',
    body,
    signal,
    timeoutMs: STORAGE_TIMEOUT_MS
  })
  if (!response.ok) return uploadFailed(routerFailureMessage(response))
  const slot = zStorageResponse.safeParse(response.json)
  const downloadUrl = slot.success ? slot.data.download_url : undefined
  if (!slot.success || !downloadUrl)
    return uploadFailed(String(response.status))
  const uploadUrl = slot.data.upload_url
  if (!slot.data.existing_file && uploadUrl) {
    const failure = await putBytes(uploadUrl, blob, mime, signal)
    if (failure) return uploadFailed(failure)
  }
  return { ok: true, value: { data: downloadUrl, mime } }
}

function liveLink(
  item: MediaItem
): item is Extract<MediaItem, { kind: 'link' }> {
  return item.kind === 'link' && item.expiresAt > Date.now()
}

async function encodeForRouter(
  item: MediaItem,
  encoding: RouterEncoding,
  signal: AbortSignal
): Promise<EncodeOutcome> {
  if (item.kind === 'text') {
    return { ok: true, value: { data: item.text, mime: 'text/plain' } }
  }
  if (encoding === 'url' && liveLink(item)) {
    const mime = item.mime ?? EXTENSION_MIME[extensionOfName(item.url)] ?? ''
    return { ok: true, value: { data: item.url, mime } }
  }
  const read = await readItemBytes(item, signal)
  if (!read.ok) return { ok: false, message: t(READ_FAILURE_KEYS[read.reason]) }
  const mime = mimeOf(read.blob, item)
  if (encoding === 'url') {
    return uploadForRouter(read.blob, mime, item.modality, signal)
  }
  const base64 = await blobToBase64(read.blob)
  const data = encoding === 'base64' ? base64 : `data:${mime};base64,${base64}`
  return { ok: true, value: { data, mime } }
}

export function createMediaEncoder(): MediaEncoder {
  const cache = new Map<string, Promise<EncodeOutcome>>()
  return (item, encoding, signal) => {
    const key = `${encoding}|${itemKey(item)}`
    const cached = cache.get(key)
    if (cached) return cached
    const pending = encodeForRouter(item, encoding, signal)
    cache.set(key, pending)
    void pending.then((outcome) => {
      if (!outcome.ok) cache.delete(key)
    })
    return pending
  }
}

async function fetchBytes(url: string, signal: AbortSignal) {
  try {
    const response = await fetch(url, {
      signal: combineAbortSignals([
        signal,
        AbortSignal.timeout(TRANSFER_TIMEOUT_MS)
      ])
    })
    return response.ok ? await response.blob() : null
  } catch {
    return null
  }
}

async function persistFile(
  blob: Blob,
  name: string,
  modality: FileModality
): Promise<PersistOutcome> {
  const fileName = `${name}.${extensionFor(blob.type, modality)}`
  const saved = await persistBlob(blob, fileName, modality)
  return saved.ok ? { ok: true, item: saved.item } : uploadFailed(saved.reason)
}

async function persistUrl(
  url: string,
  name: string,
  modality: FileModality,
  signal: AbortSignal
): Promise<PersistOutcome> {
  const blob = await fetchBytes(url, signal)
  const saved = blob ? await persistFile(blob, name, modality) : null
  if (saved?.ok) return saved
  return {
    ok: true,
    item: {
      kind: 'link',
      modality,
      url,
      expiresAt: Date.now() + LINK_LIFETIME_MS,
      mime: blob?.type || undefined
    }
  }
}

export async function persistRouterOutput(
  raw: RawRouterOutput,
  modality: Modality,
  name: string,
  signal: AbortSignal
): Promise<PersistOutcome> {
  if (raw.kind === 'text')
    return { ok: true, item: { kind: 'text', text: raw.text } }
  if (modality === 'text') {
    return { ok: false, message: t('superComfy.node.noOutput') }
  }
  switch (raw.kind) {
    case 'base64':
      return persistFile(base64ToBlob(raw.data, raw.mime), name, modality)
    case 'blob':
      return persistFile(raw.blob, name, modality)
    case 'url':
      return persistUrl(raw.url, name, modality, signal)
  }
}
