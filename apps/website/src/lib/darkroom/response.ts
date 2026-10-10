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

export function parseDarkroomResponse(payload: unknown): DarkroomResponse {
  const finals: DarkroomImagePart[] = []
  const thoughts: DarkroomImagePart[] = []
  const texts: string[] = []
  const finishReasons: string[] = []

  for (const candidate of list(field(payload, 'candidates'))) {
    const reason = text(field(candidate, 'finishReason'))
    if (reason) finishReasons.push(reason)
    for (const part of list(field(field(candidate, 'content'), 'parts'))) {
      const thought = field(part, 'thought') === true
      const image = imagePart(part)
      if (image) (thought ? thoughts : finals).push(image)
      else {
        const words = text(field(part, 'text'))
        if (words && !thought) texts.push(words)
      }
    }
  }

  const totalTokens = field(field(payload, 'usageMetadata'), 'totalTokenCount')
  return {
    images: finals.length ? finals : thoughts.slice(-1),
    texts,
    finishReasons,
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
