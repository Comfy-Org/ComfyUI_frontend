export const API_BASE_URL = 'https://api.comfy.org/v1'

export type MediaKind = 'image' | 'video' | 'audio' | 'mesh'

type ApiParameterType = 'integer' | 'number' | 'string' | 'boolean' | MediaKind

export interface ApiParameter {
  name: string
  displayName: string
  nodeTitle?: string
  type: ApiParameterType
  required: boolean
  defaultValue?: string | number | boolean
  minimum?: number
  maximum?: number
  enumValues?: string[]
}

interface OutputSource {
  nodeId: string
  title: string
}

interface ApiOutput extends OutputSource {
  /** Key of this output in the response `outputs` object. */
  key: string
}

export interface ApiSpec {
  title: string
  workflowId: string
  submitUrl: string
  jobUrl: string
  parameters: ApiParameter[]
  outputs: ApiOutput[]
}

export interface ParameterSource {
  displayName: string
  nodeTitle?: string
  widgetType: string
  value: unknown
  mediaKind?: MediaKind
  options?: {
    min?: number
    max?: number
    precision?: number
    values?: unknown
  }
}

export interface ApiSpecSource {
  title: string
  workflowId: string
  parameters: ParameterSource[]
  outputs: OutputSource[]
}

// Placeholder identity until the backend assigns real workflow IDs on
// publish: a stable hash of the workflow path, so the URL survives renders
// but demonstrates the opaque-ID contract.
export function deriveWorkflowId(seed: string): string {
  let hash = 5381
  for (let index = 0; index < seed.length; index++) {
    hash = (hash * 33) ^ seed.charCodeAt(index)
  }
  return `wf_${(hash >>> 0).toString(36)}`
}

function parameterName(displayName: string): string {
  const name = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return name || 'input'
}

function parameterType(source: ParameterSource): ApiParameterType {
  switch (source.widgetType) {
    case 'toggle':
      return 'boolean'
    case 'number':
    case 'slider':
      return source.options?.precision === 0 ? 'integer' : 'number'
    default:
      return 'string'
  }
}

function parameterDefault(
  value: unknown
): string | number | boolean | undefined {
  const isPrimitive =
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  return isPrimitive ? value : undefined
}

function enumValues(source: ParameterSource): string[] | undefined {
  const { values } = source.options ?? {}
  if (!Array.isArray(values) || !values.length) return undefined
  return values.map(String)
}

function claimUniqueName(name: string, taken: Set<string>): string {
  let unique = name
  if (taken.has(name)) {
    let suffix = 2
    while (taken.has(`${name}_${suffix}`)) suffix += 1
    unique = `${name}_${suffix}`
  }
  taken.add(unique)
  return unique
}

function buildParameter(
  source: ParameterSource,
  taken: Set<string>
): ApiParameter {
  const name = claimUniqueName(parameterName(source.displayName), taken)

  // Media widgets are combos over the server's current file list; those
  // filenames mean nothing to an API caller, so the parameter is a required
  // upload with no default and no enum.
  if (source.mediaKind) {
    return {
      name,
      displayName: source.displayName,
      nodeTitle: source.nodeTitle,
      type: source.mediaKind,
      required: true
    }
  }

  const type = parameterType(source)
  const defaultValue = parameterDefault(source.value)

  return {
    name,
    displayName: source.displayName,
    nodeTitle: source.nodeTitle,
    type,
    required: defaultValue === undefined,
    defaultValue,
    minimum: source.options?.min,
    maximum: source.options?.max,
    enumValues: type === 'string' ? enumValues(source) : undefined
  }
}

export function buildApiSpec(source: ApiSpecSource): ApiSpec {
  const parameterNames = new Set<string>()
  const outputKeys = new Set<string>()

  return {
    title: source.title,
    workflowId: source.workflowId,
    submitUrl: `${API_BASE_URL}/workflows/${source.workflowId}/run`,
    jobUrl: `${API_BASE_URL}/jobs/{job_id}`,
    parameters: source.parameters.map((entry) =>
      buildParameter(entry, parameterNames)
    ),
    outputs: source.outputs.map((output) => ({
      ...output,
      key: claimUniqueName(parameterName(output.title), outputKeys)
    }))
  }
}

const MEDIA_PLACEHOLDERS: Record<MediaKind, string> = {
  image: 'https://example.com/input.png',
  video: 'https://example.com/input.mp4',
  audio: 'https://example.com/input.mp3',
  mesh: 'https://example.com/input.glb'
}

export function isMediaParameter(parameter: ApiParameter): boolean {
  return parameter.type in MEDIA_PLACEHOLDERS
}

function placeholderValue(parameter: ApiParameter): string | number | boolean {
  if (parameter.enumValues?.length) return parameter.enumValues[0]
  switch (parameter.type) {
    case 'integer':
    case 'number':
      return parameter.minimum ?? 0
    case 'boolean':
      return false
    case 'image':
    case 'video':
    case 'audio':
    case 'mesh':
      return MEDIA_PLACEHOLDERS[parameter.type]
    default:
      return ''
  }
}

export function exampleRequestBody(
  spec: ApiSpec,
  requiredOnly = false
): Record<string, string | number | boolean> {
  const parameters = requiredOnly
    ? spec.parameters.filter((parameter) => parameter.required)
    : spec.parameters
  return Object.fromEntries(
    parameters.map((parameter) => [
      parameter.name,
      parameter.defaultValue ?? placeholderValue(parameter)
    ])
  )
}

export function exampleResponseBody(spec: ApiSpec): Record<string, unknown> {
  return {
    job_id: 'job_01hzxyz',
    status: 'completed',
    outputs: Object.fromEntries(
      spec.outputs.map((output) => [
        output.key,
        [
          {
            filename: `${output.key}.png`,
            url: `${API_BASE_URL}/assets/${output.key}.png`
          }
        ]
      ])
    )
  }
}
