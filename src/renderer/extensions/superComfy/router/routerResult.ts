import { uniqBy } from 'es-toolkit'

import type { FileModality } from '@/renderer/extensions/superComfy/engine/documentSchema'
import { findRouterFamily } from '@/renderer/extensions/superComfy/router/routerFamilies'
import {
  arrayAt,
  isRecord,
  stringAt,
  valueAt
} from '@/renderer/extensions/superComfy/router/routerJson'
import type {
  OutputsOutcome,
  RawRouterOutput,
  RouterContract,
  RouterShape
} from '@/renderer/extensions/superComfy/router/routerTypes'

export interface RouterPayload {
  json?: unknown
  blob?: Blob
  contentType: string
}

type TextReader = (json: unknown) => string

const URL_KEYS: ReadonlySet<string> = new Set([
  'url',
  'video_url',
  'image_url',
  'audio_url',
  'sample',
  'output',
  'urls',
  'images',
  'videos',
  'model_url',
  'model_urls',
  'glb'
])

const ECHO_KEYS: ReadonlySet<string> = new Set([
  'input',
  'inputs',
  'input_image',
  'request',
  'params',
  'parameters',
  'instances',
  'image_list',
  'video_list',
  'reference_images',
  'texture_image_url'
])

const BASE64_KEYS = ['b64_json', 'bytesBase64Encoded']
const MIME_KEYS = ['mimeType', 'mime_type']

const EXTENSIONS: Record<FileModality, ReadonlySet<string>> = {
  image: new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'bmp']),
  video: new Set(['mp4', 'mov', 'webm', 'mkv', 'm4v']),
  audio: new Set(['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'opus']),
  '3d': new Set(['glb', 'gltf', 'obj', 'fbx', 'usdz', 'stl', 'ply'])
}

const MODEL_PREFERENCE = ['glb', 'gltf']

const DEFAULT_MIME: Record<FileModality, string> = {
  image: 'image/png',
  video: 'video/mp4',
  audio: 'audio/mpeg',
  '3d': 'model/gltf-binary'
}

const MIME_PREFIXES: Record<FileModality, readonly string[]> = {
  image: ['image/'],
  video: ['video/'],
  audio: ['audio/'],
  '3d': ['model/', 'application/octet-stream']
}

const ERROR_PATHS: readonly (readonly string[])[] = [
  ['error', 'message'],
  ['error'],
  ['task_error', 'message'],
  ['detail']
]

function textOfParts(parts: readonly unknown[], type?: string): string {
  return parts
    .filter((part) => type === undefined || stringAt(part, ['type']) === type)
    .map((part) => stringAt(part, ['text']) ?? '')
    .join('')
}

function chatText(content: unknown): string {
  if (typeof content === 'string') return content
  return Array.isArray(content) ? textOfParts(content) : ''
}

function responsesText(json: unknown): string {
  const direct = stringAt(json, ['output_text'])
  if (direct) return direct
  const parts = arrayAt(json, ['output'])
    .filter((item) => stringAt(item, ['type']) === 'message')
    .flatMap((item) => arrayAt(item, ['content']))
  return textOfParts(parts, 'output_text')
}

function geminiText(json: unknown): string {
  const parts = arrayAt(json, ['candidates', 0, 'content', 'parts']).filter(
    (part) => valueAt(part, ['thought']) !== true
  )
  return textOfParts(parts)
}

const TEXT_READERS: Record<RouterShape, TextReader> = {
  flat: (json) => stringAt(json, ['text']) ?? '',
  anthropicMessages: (json) => textOfParts(arrayAt(json, ['content']), 'text'),
  openaiChat: (json) =>
    chatText(valueAt(json, ['choices', 0, 'message', 'content'])),
  openaiResponses: responsesText,
  geminiContents: geminiText
}

function routerErrorMessage(json: unknown): string | undefined {
  return ERROR_PATHS.map((path) => stringAt(json, path)).find(Boolean)
}

function extensionOf(url: string): string | undefined {
  try {
    const name = new URL(url).pathname.split('/').at(-1) ?? ''
    const dot = name.lastIndexOf('.')
    return dot > 0 ? name.slice(dot + 1).toLowerCase() : undefined
  } catch {
    return undefined
  }
}

function isMediaUrl(value: string, modality: FileModality): boolean {
  if (!value.startsWith('https://')) return false
  const extension = extensionOf(value)
  return extension === undefined || EXTENSIONS[modality].has(extension)
}

function mimeMatches(mime: string, modality: FileModality): boolean {
  return MIME_PREFIXES[modality].some((prefix) => mime.startsWith(prefix))
}

function inlineBase64(
  record: Record<string, unknown>,
  modality: FileModality
): RawRouterOutput[] {
  const mime = MIME_KEYS.map((key) => stringAt(record, [key])).find(Boolean)
  const keys = mime ? [...BASE64_KEYS, 'data'] : BASE64_KEYS
  const data = keys.map((key) => stringAt(record, [key])).find(Boolean)
  if (!data || /^https?:/.test(data)) return []
  const resolved = mime ?? DEFAULT_MIME[modality]
  return mimeMatches(resolved, modality)
    ? [{ kind: 'base64', data, mime: resolved }]
    : []
}

function walk(
  value: unknown,
  modality: FileModality,
  underUrlKey: boolean
): RawRouterOutput[] {
  if (typeof value === 'string') {
    return underUrlKey && isMediaUrl(value, modality)
      ? [{ kind: 'url', url: value }]
      : []
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => walk(item, modality, underUrlKey))
  }
  if (!isRecord(value)) return []
  const inline = inlineBase64(value, modality)
  if (inline.length > 0) return inline
  return Object.entries(value).flatMap(([key, child]) =>
    ECHO_KEYS.has(key)
      ? []
      : walk(child, modality, underUrlKey || URL_KEYS.has(key))
  )
}

function outputKey(output: RawRouterOutput): string {
  switch (output.kind) {
    case 'url':
      return output.url
    case 'base64':
      return output.data
    case 'text':
      return output.text
    case 'blob':
      return ''
  }
}

function modelRank(output: RawRouterOutput): number {
  const extension = output.kind === 'url' ? extensionOf(output.url) : undefined
  const rank = MODEL_PREFERENCE.indexOf(extension ?? '')
  return rank === -1 ? MODEL_PREFERENCE.length : rank
}

function preferredModel(outputs: RawRouterOutput[]): RawRouterOutput[] {
  const best = outputs.reduce<RawRouterOutput | undefined>(
    (chosen, output) =>
      !chosen || modelRank(output) < modelRank(chosen) ? output : chosen,
    undefined
  )
  return best ? [best] : []
}

function readMedia(json: unknown, modality: FileModality): OutputsOutcome {
  const found = uniqBy(walk(json, modality, false), outputKey)
  const outputs = modality === '3d' ? preferredModel(found) : found
  return outputs.length > 0
    ? { ok: true, outputs }
    : { ok: false, message: routerErrorMessage(json) }
}

function readText(contract: RouterContract, json: unknown): OutputsOutcome {
  const text =
    contract.shape === 'family' ? '' : TEXT_READERS[contract.shape](json)
  return text
    ? { ok: true, outputs: [{ kind: 'text', text }] }
    : { ok: false, message: routerErrorMessage(json) }
}

export function extractRouterOutputs(
  contract: RouterContract,
  payload: RouterPayload
): OutputsOutcome {
  if (payload.blob) {
    return { ok: true, outputs: [{ kind: 'blob', blob: payload.blob }] }
  }
  const { modality } = contract
  if (modality === 'text') return readText(contract, payload.json)
  const family =
    contract.shape === 'family' ? findRouterFamily(contract.modelId) : undefined
  if (family) return family.readResult(payload.json)
  return readMedia(payload.json, modality)
}
