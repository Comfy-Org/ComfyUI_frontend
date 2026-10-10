/**
 * Reads the Gemini `generateContent` response Router forwards for the Nano
 * Banana models. An image arrives as base64 at `inlineData`, or as a signed
 * link at `fileData` when Router stored it, and one response can mix both.
 */

export type DarkroomImagePart =
  | { readonly mime: string; readonly data: string }
  | { readonly mime: string; readonly uri: string }

export interface DarkroomStats {
  readonly seconds?: number
  readonly modelVersion?: string
  readonly totalTokens?: number
  readonly finishReasons: readonly string[]
  readonly fallbackProvider?: string
  readonly droppedParams?: string
}

export interface DarkroomResponse {
  /** The final images, or the last thinking preview if nothing else came. */
  readonly images: readonly DarkroomImagePart[]
  readonly texts: readonly string[]
  readonly finishReasons: readonly string[]
  readonly blockReason?: string
  readonly modelVersion?: string
  readonly totalTokens?: number
}

function field(value: unknown, key: string): unknown {
  return value !== null && typeof value === 'object'
    ? Reflect.get(value, key)
    : undefined
}

function list(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : []
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined
}

function imagePart(part: unknown): DarkroomImagePart | undefined {
  const inline = field(part, 'inlineData')
  const data = text(field(inline, 'data'))
  if (data)
    return { mime: text(field(inline, 'mimeType')) ?? 'image/png', data }
  const file = field(part, 'fileData')
  const uri = text(field(file, 'fileUri'))
  if (uri?.startsWith('https://'))
    return { mime: text(field(file, 'mimeType')) ?? 'image/png', uri }
  return undefined
}

interface ReadPart {
  readonly image?: DarkroomImagePart
  readonly words?: string
  /** A thinking preview, not part of the answer. */
  readonly thought: boolean
}

function readPart(part: unknown): ReadPart {
  const image = imagePart(part)
  return {
    thought: field(part, 'thought') === true,
    ...(image ? { image } : { words: text(field(part, 'text')) })
  }
}

function imagesOf(parts: readonly ReadPart[], thought: boolean) {
  return parts.flatMap((part) =>
    part.image && part.thought === thought ? [part.image] : []
  )
}

export function parseDarkroomResponse(payload: unknown): DarkroomResponse {
  const candidates = list(field(payload, 'candidates'))
  const parts = candidates
    .flatMap((candidate) => list(field(field(candidate, 'content'), 'parts')))
    .map(readPart)
  const finals = imagesOf(parts, false)
  const totalTokens = field(field(payload, 'usageMetadata'), 'totalTokenCount')
  return {
    images: finals.length ? finals : imagesOf(parts, true).slice(-1),
    texts: parts.flatMap((part) =>
      part.words && !part.thought ? [part.words] : []
    ),
    finishReasons: candidates.flatMap(
      (candidate) => text(field(candidate, 'finishReason')) ?? []
    ),
    blockReason: text(field(field(payload, 'promptFeedback'), 'blockReason')),
    modelVersion: text(field(payload, 'modelVersion')),
    totalTokens: typeof totalTokens === 'number' ? totalTokens : undefined
  }
}

export function base64Bytes(data: string): Uint8Array<ArrayBuffer> {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++)
    bytes[index] = binary.charCodeAt(index)
  return bytes
}
