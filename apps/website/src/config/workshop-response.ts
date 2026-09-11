import type { WorkshopContract } from './workshop-contract'
import { validateWorkshopInput } from './workshop-json-schema'
import { valuesAtPointer } from './workshop-json-pointer'
import type { RunOutput } from './workshop-run'
import {
  inlineOutput,
  isPassiveOutputMime,
  outputExtension,
  outputKind,
  outputMimeForUrl
} from './workshop-output-media'

const MAX_RESPONSE_BYTES = 128 * 1024 * 1024

function blobSource(blob: Blob) {
  return { url: URL.createObjectURL(blob), byteLength: blob.size }
}

function fileName(id: string, mime: string, index: number): string {
  return `${id.replaceAll('/', '-')}-${index + 1}.${outputExtension(mime)}`
}

function responseDocument(
  id: string,
  text: string,
  mime = 'application/json'
): RunOutput {
  const safeMime = mime === 'application/json' ? mime : 'text/plain'
  return {
    kind: 'text',
    text: text.slice(0, 65_536),
    truncated: text.length > 65_536,
    ...blobSource(new Blob([text], { type: safeMime })),
    fileName: `${id.replaceAll('/', '-')}-response.${outputExtension(safeMime)}`
  }
}

function automaticOutputs(
  contract: WorkshopContract,
  data: unknown
): RunOutput[] {
  const outputs: RunOutput[] = []
  const seen = new Set<string>()
  const extracted = new Map<string, string>()
  function visit(value: unknown, depth: number, mimeHint?: string) {
    if (depth > 64 || outputs.length >= 256) return
    if (typeof value === 'string' && !seen.has(value)) {
      if (value.startsWith('https://')) {
        const url = URL.parse(value)
        if (!url || url.username || url.password) return
        const mime = outputMimeForUrl(value)
        outputs.push({
          kind: outputKind(mime),
          url: url.href,
          fileName: fileName(contract.id, mime, outputs.length)
        })
        seen.add(value)
      } else {
        const inline = inlineOutput(value, mimeHint)
        if (!inline) return
        const name = fileName(contract.id, inline.mime, outputs.length)
        outputs.push({
          kind: outputKind(inline.mime),
          ...blobSource(
            new Blob([new Uint8Array(inline.bytes)], { type: inline.mime })
          ),
          fileName: name
        })
        extracted.set(value, name)
        seen.add(value)
      }
    } else if (value !== null && typeof value === 'object') {
      const entries = Object.entries(value)
      const hint: unknown = entries.find(
        ([key]) => key === 'mimeType' || key === 'mime_type'
      )?.[1]
      for (const [key, child] of entries)
        visit(
          child,
          depth + 1,
          key === 'data' && typeof hint === 'string' ? hint : undefined
        )
    }
  }
  try {
    visit(data, 0)
    const text = JSON.stringify(
      data,
      (_key, value: unknown) =>
        typeof value === 'string' && extracted.has(value)
          ? `[media saved as ${extracted.get(value)}]`
          : value,
      2
    )
    const document = responseDocument(contract.id, text)
    outputs.push(
      extracted.size
        ? {
            ...document,
            fileName: `${contract.id.replaceAll('/', '-')}-metadata.json`
          }
        : document
    )
    return outputs
  } catch (error) {
    releaseRouterOutputs(outputs)
    throw error
  }
}

async function responseBytes(response: Response): Promise<Uint8Array> {
  if (Number(response.headers.get('Content-Length')) > MAX_RESPONSE_BYTES)
    throw new Error('Router output exceeds the limit')
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Empty Router response')
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > MAX_RESPONSE_BYTES)
        throw new Error('Router output exceeds the limit')
      chunks.push(value)
    }
  } catch (error) {
    await reader.cancel().catch(() => {})
    throw error
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

export function releaseRouterOutputs(outputs: readonly RunOutput[]): void {
  for (const output of outputs)
    for (const url of new Set([output.url, ...(output.urls ?? [])]))
      if (url.startsWith('blob:')) URL.revokeObjectURL(url)
}

export async function parseRouterResponse(
  contract: WorkshopContract,
  response: Response
): Promise<RunOutput[]> {
  const bytes = await responseBytes(response)
  const contentType =
    response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() ??
    ''
  const { output } = contract
  if (output.format === 'auto') {
    if (!bytes.length) throw new Error('Empty Router response')
    if (
      !output.contentTypes.some(
        (type) =>
          type === '*/*' ||
          type === contentType ||
          (type.endsWith('/*') && contentType.startsWith(type.slice(0, -1)))
      )
    )
      throw new Error('Unexpected Router output type')
    if (contentType === 'application/json' || contentType.endsWith('+json')) {
      const data: unknown = JSON.parse(new TextDecoder().decode(bytes))
      if (output.schema && !validateWorkshopInput(data, output.schema))
        throw new Error('Invalid Router response')
      return automaticOutputs(contract, data)
    }
    if (contentType === 'text/plain' || contentType === 'text/event-stream')
      return [
        responseDocument(
          contract.id,
          new TextDecoder().decode(bytes),
          'text/plain'
        )
      ]
    const kind = outputKind(contentType)
    return [
      {
        kind,
        ...blobSource(
          new Blob([new Uint8Array(bytes)], {
            type: kind === 'other' ? 'application/octet-stream' : contentType
          })
        ),
        fileName: fileName(contract.id, contentType, 0)
      }
    ]
  }
  if (output.format === 'binary') {
    if (
      !bytes.length ||
      !output.contentTypes.some(
        (type) =>
          type === contentType ||
          (type.endsWith('/*') && contentType.startsWith(type.slice(0, -1)))
      )
    )
      throw new Error('Unexpected Router output type')
    const source = blobSource(
      new Blob([new Uint8Array(bytes)], {
        type: isPassiveOutputMime(contentType)
          ? contentType
          : 'application/octet-stream'
      })
    )
    return [
      {
        kind: isPassiveOutputMime(contentType) ? output.kind : 'other',
        ...source,
        fileName: fileName(contract.id, contentType, 0)
      }
    ]
  }
  if (contentType !== 'application/json' && !contentType.endsWith('+json'))
    throw new Error('Expected a JSON Router response')
  const data: unknown = JSON.parse(new TextDecoder().decode(bytes))
  if (!validateWorkshopInput(data, output.schema))
    throw new Error('Invalid Router response')
  if (output.success) {
    const normalize = (value: unknown) =>
      output.success?.caseInsensitive && typeof value === 'string'
        ? value.trim().toLowerCase()
        : value
    const status = valuesAtPointer(data, output.success.path)
    if (
      status.length !== 1 ||
      !output.success.values.some(
        (value) => normalize(value) === normalize(status[0])
      )
    )
      throw new Error('Router did not return terminal success')
  }
  const nsfw = output.nsfwPath
    ? valuesAtPointer(data, output.nsfwPath).some((value) => value === true)
    : false
  const outputs: RunOutput[] = []
  try {
    for (const selector of output.selectors) {
      for (const value of valuesAtPointer(data, selector.path)) {
        if (value === null || value === undefined || value === '') continue
        const mime =
          selector.mimeType ??
          (selector.kind === 'text' ? 'text/plain' : 'application/octet-stream')
        const name = fileName(contract.id, mime, outputs.length)
        if (selector.encoding === 'text' || selector.encoding === 'json') {
          if (selector.encoding === 'text' && typeof value !== 'string')
            throw new Error('Invalid text output')
          outputs.push({
            ...responseDocument(
              contract.id,
              typeof value === 'string'
                ? value
                : JSON.stringify(value, null, 2),
              mime
            ),
            fileName: name,
            nsfw
          })
          continue
        }
        if (typeof value !== 'string') throw new Error('Invalid media output')
        let source: Pick<RunOutput, 'url' | 'byteLength'>
        if (selector.encoding === 'url') {
          const parsed = new URL(value)
          if (
            parsed.protocol !== 'https:' ||
            parsed.username ||
            parsed.password
          )
            throw new Error('Unsafe media URL')
          source = { url: parsed.href }
        } else {
          if (!selector.mimeType || !isPassiveOutputMime(selector.mimeType))
            throw new Error('Missing inline media type')
          const decoded = Uint8Array.from(atob(value), (character) =>
            character.charCodeAt(0)
          )
          if (!decoded.length) throw new Error('Empty inline media')
          source = blobSource(new Blob([decoded], { type: mime }))
        }
        outputs.push({
          kind: mime === 'image/svg+xml' ? 'other' : selector.kind,
          ...source,
          fileName: name,
          nsfw
        })
      }
    }
    if (!outputs.length) throw new Error('Router returned no output')
    return outputs
  } catch (error) {
    releaseRouterOutputs(outputs)
    throw error
  }
}
