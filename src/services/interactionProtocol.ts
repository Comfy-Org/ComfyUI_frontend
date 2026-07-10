export const INTERACTION_MEDIA = 5
const MAX_INTERACTION_METADATA_BYTES = 4096
export const MAX_INTERACTION_MEDIA_BYTES = 8 * 1024 * 1024

export type InteractionControl = {
  v: 1
  op: 'open' | 'resume' | 'credit' | 'closed' | 'error'
  interaction_id: string
  prompt_id?: string
  node_id?: string
  display_node_id?: string
  group_id?: string
  list_index?: number | null
  kind?: string
  limits?: {
    mime_types?: string[]
    max_frame_bytes?: number
    max_inflight?: number
  }
  count?: number
  reason?: string
  message?: string
}

export type InteractionMediaMetadata = {
  v: 1
  interaction_id: string
  prompt_id?: string
  channel: 'source' | 'result'
  seq: number
  capture_ts_ms: number
  mime: 'image/jpeg'
  input_seq?: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function parseInteractionControl(value: unknown): InteractionControl {
  if (
    !isRecord(value) ||
    value.v !== 1 ||
    typeof value.op !== 'string' ||
    typeof value.interaction_id !== 'string' ||
    value.interaction_id.length === 0 ||
    (value.prompt_id !== undefined && typeof value.prompt_id !== 'string') ||
    (value.node_id !== undefined && typeof value.node_id !== 'string') ||
    (value.display_node_id !== undefined &&
      typeof value.display_node_id !== 'string') ||
    (value.group_id !== undefined && typeof value.group_id !== 'string') ||
    (value.kind !== undefined && typeof value.kind !== 'string') ||
    (value.list_index !== undefined &&
      value.list_index !== null &&
      (typeof value.list_index !== 'number' ||
        !Number.isSafeInteger(value.list_index) ||
        value.list_index < 0)) ||
    (value.count !== undefined &&
      (typeof value.count !== 'number' ||
        !Number.isSafeInteger(value.count) ||
        value.count < 1)) ||
    (value.reason !== undefined && typeof value.reason !== 'string') ||
    (value.message !== undefined && typeof value.message !== 'string')
  )
    throw new Error('Invalid interaction control')
  if (!['open', 'resume', 'credit', 'closed', 'error'].includes(value.op))
    throw new Error('Invalid interaction operation')
  if (value.limits !== undefined) {
    if (!isRecord(value.limits)) throw new Error('Invalid interaction limits')
    const {
      mime_types: mimeTypes,
      max_frame_bytes: maxFrameBytes,
      max_inflight: maxInflight
    } = value.limits
    if (
      (mimeTypes !== undefined &&
        (!Array.isArray(mimeTypes) ||
          mimeTypes.some((mime) => typeof mime !== 'string'))) ||
      (maxFrameBytes !== undefined &&
        (typeof maxFrameBytes !== 'number' ||
          !Number.isSafeInteger(maxFrameBytes) ||
          maxFrameBytes < 1)) ||
      (maxInflight !== undefined &&
        (typeof maxInflight !== 'number' ||
          !Number.isSafeInteger(maxInflight) ||
          maxInflight < 1))
    )
      throw new Error('Invalid interaction limits')
  }
  return value as InteractionControl
}

export function encodeInteractionMedia(
  metadata: InteractionMediaMetadata,
  media: ArrayBuffer
): ArrayBuffer {
  const encoded = new TextEncoder().encode(JSON.stringify(metadata))
  if (encoded.length > MAX_INTERACTION_METADATA_BYTES)
    throw new Error('Interaction metadata is too large')
  if (media.byteLength > MAX_INTERACTION_MEDIA_BYTES)
    throw new Error('Interaction media is too large')
  const result = new Uint8Array(8 + encoded.length + media.byteLength)
  new DataView(result.buffer).setUint32(0, INTERACTION_MEDIA)
  new DataView(result.buffer).setUint32(4, encoded.length)
  result.set(encoded, 8)
  result.set(new Uint8Array(media), 8 + encoded.length)
  return result.buffer
}

export function decodeInteractionMedia(data: ArrayBuffer): {
  metadata: InteractionMediaMetadata
  media: ArrayBuffer
} {
  if (data.byteLength < 9) throw new Error('Truncated interaction media')
  const view = new DataView(data)
  if (view.getUint32(0) !== INTERACTION_MEDIA)
    throw new Error('Invalid interaction media type')
  const length = view.getUint32(4)
  if (
    length === 0 ||
    length > MAX_INTERACTION_METADATA_BYTES ||
    8 + length >= data.byteLength
  )
    throw new Error('Invalid interaction metadata length')
  if (data.byteLength - 8 - length > MAX_INTERACTION_MEDIA_BYTES)
    throw new Error('Interaction media is too large')
  const value: unknown = JSON.parse(
    new TextDecoder('utf-8', { fatal: true }).decode(data.slice(8, 8 + length))
  )
  if (
    !isRecord(value) ||
    value.v !== 1 ||
    typeof value.interaction_id !== 'string' ||
    value.interaction_id.length === 0 ||
    (value.prompt_id !== undefined && typeof value.prompt_id !== 'string') ||
    !['source', 'result'].includes(String(value.channel)) ||
    typeof value.seq !== 'number' ||
    !Number.isSafeInteger(value.seq) ||
    value.seq < 0 ||
    typeof value.capture_ts_ms !== 'number' ||
    !Number.isFinite(value.capture_ts_ms) ||
    (value.input_seq !== undefined &&
      (typeof value.input_seq !== 'number' ||
        !Number.isSafeInteger(value.input_seq) ||
        value.input_seq < 0)) ||
    value.mime !== 'image/jpeg'
  )
    throw new Error('Invalid interaction media metadata')
  return {
    metadata: value as InteractionMediaMetadata,
    media: data.slice(8 + length)
  }
}
