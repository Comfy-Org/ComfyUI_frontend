import type { WorkshopContract } from './workshop-contract'
import { validateWorkshopInput } from './workshop-json-schema'
import { valuesAtPointer } from './workshop-json-pointer'
import type { RunOutput } from './workshop-run'
import type { WorkshopSvgRasterizer } from './workshop-svg-output'
import { svgOutputs } from './workshop-svg-output'
import {
  discoverOutputMimes,
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

interface OutputContext {
  readonly id: string
  readonly signal?: AbortSignal
  readonly rasterizeSvg?: WorkshopSvgRasterizer
}

type JsonOutput = Extract<WorkshopContract['output'], { format: 'json' }>
type OutputSelector = JsonOutput['selectors'][number]

async function automaticOutputs(
  data: unknown,
  context: OutputContext
): Promise<RunOutput[]> {
  const { id, signal, rasterizeSvg } = context
  const outputs: RunOutput[] = []
  const seen = new Set<string>()
  const extracted = new Map<string, string>()
  function collectString(value: string, mimeHint?: string) {
    if (value.startsWith('https://')) {
      const url = URL.parse(value)
      if (!url || url.username || url.password) return
      const mime = outputMimeForUrl(value)
      outputs.push({
        kind: outputKind(mime),
        url: url.href,
        fileName: fileName(id, mime, outputs.length)
      })
      seen.add(value)
      return
    }
    const inline = inlineOutput(value, mimeHint)
    if (!inline) return
    const name = fileName(id, inline.mime, outputs.length)
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
  function visit(value: unknown, depth: number, mimeHint?: string) {
    if (depth > 64 || outputs.length >= 256) return
    if (typeof value === 'string') {
      if (!seen.has(value)) collectString(value, mimeHint)
      return
    }
    if (value === null || typeof value !== 'object') return
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
  try {
    visit(data, 0)
    const discovered = await discoverOutputMimes(
      outputs.map(({ url }) => url),
      signal
    )
    for (const [index, output] of outputs.entries()) {
      const mime = discovered.get(output.url) ?? outputMimeForUrl(output.url)
      if (mime === 'image/svg+xml') {
        const [preview, ...attachments] = await svgOutputs(
          output.url,
          fileName(id, mime, index),
          signal,
          rasterizeSvg
        )
        outputs[index] = preview
        outputs.push(...attachments)
      } else if (discovered.has(output.url))
        outputs[index] = {
          ...output,
          kind: outputKind(mime),
          fileName: fileName(id, mime, index)
        }
    }
    const text = JSON.stringify(
      data,
      (_key, value: unknown) =>
        typeof value === 'string' && extracted.has(value)
          ? `[media saved as ${extracted.get(value)}]`
          : value,
      2
    )
    const document = responseDocument(id, text)
    outputs.push(
      extracted.size
        ? {
            ...document,
            fileName: `${id.replaceAll('/', '-')}-metadata.json`
          }
        : document
    )
    return outputs
  } catch (error) {
    releaseRouterOutputs(outputs)
    throw error
  }
}

async function responseBytes(
  response: Response,
  maxBytes: number
): Promise<Uint8Array> {
  if (Number(response.headers.get('Content-Length')) > maxBytes)
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
      if (length > maxBytes) throw new Error('Router output exceeds the limit')
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

function matchesContentType(
  types: readonly string[],
  contentType: string
): boolean {
  return types.some(
    (type) =>
      type === contentType ||
      (type.endsWith('/*') && contentType.startsWith(type.slice(0, -1)))
  )
}

function isJsonContentType(contentType: string): boolean {
  return contentType === 'application/json' || contentType.endsWith('+json')
}

function jsonResponse(
  bytes: Uint8Array,
  contentType: string,
  schema?: JsonOutput['schema']
): unknown {
  if (!isJsonContentType(contentType))
    throw new Error('Expected a JSON Router response')
  const data: unknown = JSON.parse(new TextDecoder().decode(bytes))
  if (schema && !validateWorkshopInput(data, schema))
    throw new Error('Invalid Router response')
  return data
}

async function binaryOutputs(
  bytes: Uint8Array,
  description: {
    readonly mime: string
    readonly blobMime: string
    readonly kind: RunOutput['kind']
  },
  context: OutputContext
): Promise<RunOutput[]> {
  const name = fileName(context.id, description.mime, 0)
  if (description.mime === 'image/svg+xml')
    return svgOutputs(
      new Blob([new Uint8Array(bytes)]),
      name,
      context.signal,
      context.rasterizeSvg
    )
  return [
    {
      kind: description.kind,
      ...blobSource(
        new Blob([new Uint8Array(bytes)], { type: description.blobMime })
      ),
      fileName: name
    }
  ]
}

async function automaticResponse(
  output: Extract<WorkshopContract['output'], { format: 'auto' }>,
  bytes: Uint8Array,
  contentType: string,
  context: OutputContext
): Promise<RunOutput[]> {
  if (!bytes.length) throw new Error('Empty Router response')
  if (
    !output.contentTypes.includes('*/*') &&
    !matchesContentType(output.contentTypes, contentType)
  )
    throw new Error('Unexpected Router output type')
  if (isJsonContentType(contentType))
    return automaticOutputs(
      jsonResponse(bytes, contentType, output.schema),
      context
    )
  if (contentType === 'text/plain' || contentType === 'text/event-stream')
    return [
      responseDocument(
        context.id,
        new TextDecoder().decode(bytes),
        'text/plain'
      )
    ]
  const kind = outputKind(contentType)
  return binaryOutputs(
    bytes,
    {
      mime: contentType,
      kind,
      blobMime: kind === 'other' ? 'application/octet-stream' : contentType
    },
    context
  )
}

function binaryResponse(
  output: Extract<WorkshopContract['output'], { format: 'binary' }>,
  bytes: Uint8Array,
  contentType: string,
  context: OutputContext
): Promise<RunOutput[]> {
  if (!bytes.length || !matchesContentType(output.contentTypes, contentType))
    throw new Error('Unexpected Router output type')
  const passive = isPassiveOutputMime(contentType)
  return binaryOutputs(
    bytes,
    {
      mime: contentType,
      blobMime: passive ? contentType : 'application/octet-stream',
      kind: passive ? output.kind : 'other'
    },
    context
  )
}

function assertTerminalSuccess(
  data: unknown,
  success: JsonOutput['success']
): void {
  if (!success) return
  const normalize = (value: unknown) =>
    success.caseInsensitive && typeof value === 'string'
      ? value.trim().toLowerCase()
      : value
  const status = valuesAtPointer(data, success.path)
  if (
    status.length !== 1 ||
    !success.values.some((value) => normalize(value) === normalize(status[0]))
  )
    throw new Error('Router did not return terminal success')
}

function selectorMime(selector: OutputSelector, value: unknown): string {
  if (selector.mimeType) return selector.mimeType
  if (selector.encoding === 'url' && typeof value === 'string')
    return outputMimeForUrl(value)
  return selector.kind === 'text' ? 'text/plain' : 'application/octet-stream'
}

function selectedMediaSource(
  selector: OutputSelector,
  value: string,
  mime: string
): Pick<RunOutput, 'url' | 'byteLength'> {
  if (selector.encoding === 'url') {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password)
      throw new Error('Unsafe media URL')
    return { url: parsed.href }
  }
  if (!selector.mimeType || !isPassiveOutputMime(selector.mimeType))
    throw new Error('Missing inline media type')
  const decoded = Uint8Array.from(atob(value), (character) =>
    character.charCodeAt(0)
  )
  if (!decoded.length) throw new Error('Empty inline media')
  return blobSource(new Blob([decoded], { type: mime }))
}

async function selectedValue(
  value: unknown,
  selector: OutputSelector,
  index: number,
  context: OutputContext & { readonly nsfw: boolean }
): Promise<RunOutput[]> {
  if (value === null || value === undefined || value === '') return []
  const mime = selectorMime(selector, value)
  const name = fileName(context.id, mime, index)
  if (selector.encoding === 'text' || selector.encoding === 'json') {
    if (selector.encoding === 'text' && typeof value !== 'string')
      throw new Error('Invalid text output')
    const text =
      typeof value === 'string' ? value : JSON.stringify(value, null, 2)
    return [
      {
        ...responseDocument(context.id, text, mime),
        fileName: name,
        nsfw: context.nsfw
      }
    ]
  }
  if (typeof value !== 'string') throw new Error('Invalid media output')
  if (
    selector.encoding === 'url' &&
    (mime === 'image/svg+xml' || outputMimeForUrl(value) === 'image/svg+xml')
  )
    return (
      await svgOutputs(
        value,
        fileName(context.id, 'image/svg+xml', index),
        context.signal,
        context.rasterizeSvg
      )
    ).map((output) => ({ ...output, nsfw: context.nsfw }))
  return [
    {
      kind: mime === 'image/svg+xml' ? 'other' : selector.kind,
      ...selectedMediaSource(selector, value, mime),
      fileName: name,
      nsfw: context.nsfw
    }
  ]
}

async function selectedResponse(
  output: JsonOutput,
  bytes: Uint8Array,
  contentType: string,
  context: OutputContext
): Promise<RunOutput[]> {
  const data = jsonResponse(bytes, contentType, output.schema)
  assertTerminalSuccess(data, output.success)
  const nsfw = output.nsfwPath
    ? valuesAtPointer(data, output.nsfwPath).some((value) => value === true)
    : false
  const outputs: RunOutput[] = []
  try {
    for (const selector of output.selectors)
      for (const value of valuesAtPointer(data, selector.path))
        outputs.push(
          ...(await selectedValue(value, selector, outputs.length, {
            ...context,
            nsfw
          }))
        )
    if (!outputs.length) throw new Error('Router returned no output')
    return outputs
  } catch (error) {
    releaseRouterOutputs(outputs)
    throw error
  }
}

export async function parseRouterResponse(
  contract: WorkshopContract,
  response: Response,
  signal?: AbortSignal,
  rasterizeSvg?: WorkshopSvgRasterizer
): Promise<RunOutput[]> {
  signal?.throwIfAborted()
  const contentType =
    response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() ??
    ''
  const bytes = await responseBytes(
    response,
    contentType === 'image/svg+xml' ? 4 * 1024 * 1024 : MAX_RESPONSE_BYTES
  )
  const context = { id: contract.id, signal, rasterizeSvg }
  switch (contract.output.format) {
    case 'auto':
      return automaticResponse(contract.output, bytes, contentType, context)
    case 'binary':
      return binaryResponse(contract.output, bytes, contentType, context)
    case 'json':
      return selectedResponse(contract.output, bytes, contentType, context)
  }
}
