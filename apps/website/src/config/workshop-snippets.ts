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

export function buildWorkshopSnippet(
  language: WorkshopSnippetLanguage,
  modelId: string,
  fields: readonly WorkshopField[],
  values: WorkshopFormValues
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
  // An idempotency key, assigned once and reused. These are paid calls, and a
  // disconnect can happen after the model has already run; retrying the same
  // command without the same key runs and bills it a second time. Both SDKs
  // mint one, so only the raw request needs this. Held in a variable rather
  // than inlined so re-running just the curl — the actual retry — sends the
  // key it sent the first time.
  return [
    `IDEMPOTENCY_KEY=$(uuidgen)`,
    ``,
    `curl --request POST '${endpoint}' ${continuation}`,
    `  --header 'Authorization: Bearer YOUR_API_KEY' ${continuation}`,
    `  --header 'Content-Type: application/json' ${continuation}`,
    `  --header "Idempotency-Key: $IDEMPOTENCY_KEY" ${continuation}`,
    `  --data '${shellSingleQuote(JSON.stringify(input, null, 2))}'`
  ].join('\n')
}
