import type { WorkshopField, WorkshopFormValues } from './workshop-detail'
export type WorkshopSnippetLanguage = 'typescript' | 'python' | 'http'

export const WORKSHOP_SNIPPET_LANGUAGES: readonly WorkshopSnippetLanguage[] = [
  'typescript',
  'python',
  'http'
]

/**
 * The form records a picked file as `<name.png>`, which is not something the
 * API accepts — `medias[].value` is a URL. Copying that verbatim produces a
 * command that fails with `invalid_input` and no clue why, on the 197 models
 * that take media. Swap it for an obvious stand-in the reader will replace.
 */
function mediaPlaceholder(upload: string): string {
  const local = /^<(.+)>$/.exec(upload)
  if (local === null) return upload
  return `https://example.com/replace-with-a-url/${local[1]}`
}

export function buildWorkshopInput(
  fields: readonly WorkshopField[],
  values: WorkshopFormValues
): Record<string, unknown> {
  const input: Record<string, unknown> = {}
  const medias: Array<{ role: string; value: string }> = []
  for (const field of fields) {
    const value = values[field.name]
    if (value === undefined || value === '') continue
    if (field.kind === 'media') {
      const uploads = Array.isArray(value) ? value : [String(value)]
      medias.push(
        ...uploads.map((upload) => ({
          role: field.role,
          value: mediaPlaceholder(upload)
        }))
      )
    } else if (field.kind === 'text' && field.valueType === 'json') {
      try {
        input[field.name] = JSON.parse(String(value))
      } catch {
        input[field.name] = value
      }
    } else {
      input[field.name] = value
    }
  }
  if (medias.length > 0) input.medias = medias
  return input
}

function pythonLiteral(value: unknown, depth = 0): string {
  const pad = '    '.repeat(depth)
  const childPad = '    '.repeat(depth + 1)
  if (value === null) return 'None'
  if (value === true) return 'True'
  if (value === false) return 'False'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    return `[\n${value.map((item) => `${childPad}${pythonLiteral(item, depth + 1)}`).join(',\n')}\n${pad}]`
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value)
    if (entries.length === 0) return '{}'
    return `{\n${entries
      .map(
        ([key, item]) =>
          `${childPad}${JSON.stringify(key)}: ${pythonLiteral(item, depth + 1)}`
      )
      .join(',\n')}\n${pad}}`
  }
  return 'None'
}

/**
 * Escapes a value for a POSIX single-quoted argument.
 *
 * A single quote cannot appear inside single quotes at all, so the string is
 * closed, an escaped quote is emitted, and the string is reopened: `'\''`.
 * Prompts contain apostrophes constantly, and without this the generated
 * command ends its quote early and no longer parses.
 */
function shellSingleQuote(value: string): string {
  return value.replaceAll("'", `'\\''`)
}

function modelEndpoint(modelId: string): string {
  const encodedId = modelId.split('/').map(encodeURIComponent).join('/')
  return `https://api.comfy.org/v2/models/${encodedId}`
}

/**
 * A v4 UUID for the raw request's `Idempotency-Key`.
 *
 * Not `crypto.randomUUID()`: that one is restricted to secure contexts, and it
 * is undefined on exactly the insecure LAN-IP and staging origins the clipboard
 * fallback in `WorkshopPlayground.vue` exists for. `getRandomValues` carries no
 * such restriction, so this works everywhere the page does.
 *
 * The value is rendered into the snippet as a literal rather than computed by
 * the shell. An earlier version used `$(uuidgen)`, which is absent on most
 * Linux images — the command failed and the request went out with an empty key,
 * which is the one thing the header must never be.
 */
export function workshopIdempotencyKey(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20)
  ].join('-')
}

export function buildWorkshopSnippet(
  language: WorkshopSnippetLanguage,
  modelId: string,
  fields: readonly WorkshopField[],
  values: WorkshopFormValues,
  /**
   * Required rather than defaulted, so no call site can quietly emit a snippet
   * with no key. Only the raw request uses it; both SDKs mint their own.
   */
  idempotencyKey: string
): string {
  const input = buildWorkshopInput(fields, values)
  const modelIdLiteral = JSON.stringify(modelId)
  if (language === 'typescript') {
    return [
      "import { comfy } from '@comfyorg/sdk'",
      '',
      "comfy.config({ credentials: 'YOUR_API_KEY' })",
      `const { data } = await comfy.models.run(${modelIdLiteral}, ${JSON.stringify(input, null, 2)})`
    ].join('\n')
  }
  if (language === 'python') {
    return [
      'from comfy_sdk import Comfy',
      '',
      'comfy = Comfy(api_key="YOUR_API_KEY")',
      `result = comfy.models.run(${modelIdLiteral}, ${pythonLiteral(input)})`
    ].join('\n')
  }
  const continuation = '\\'
  const endpoint = shellSingleQuote(modelEndpoint(modelId))
  // These are paid calls, and a disconnect can happen after the model has
  // already run, so a retry that does not carry the same key runs and bills it
  // a second time. The key is baked in as a literal, which is what makes the
  // copied block stable: re-running it — the whole thing, however the reader
  // pasted it — sends the key it sent the first time, which is precisely what a
  // retry needs. A fresh key means a deliberately new call, and comes from
  // reloading the page.
  return [
    `curl --request POST '${endpoint}' ${continuation}`,
    `  --header 'Authorization: Bearer YOUR_API_KEY' ${continuation}`,
    `  --header 'Content-Type: application/json' ${continuation}`,
    `  --header 'Idempotency-Key: ${shellSingleQuote(idempotencyKey)}' ${continuation}`,
    `  --data '${shellSingleQuote(JSON.stringify(input, null, 2))}'`
  ].join('\n')
}
