import type {
  Modality,
  PortSpec,
  SettingSpec,
  SettingValue
} from '@/renderer/extensions/superComfy/engine/documentSchema'

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export type JsonObject = { [key: string]: JsonValue }

export interface JsonSchema {
  $ref?: string
  type?: string | string[]
  enum?: unknown[]
  default?: unknown
  const?: unknown
  minimum?: number
  maximum?: number
  exclusiveMinimum?: number | boolean
  exclusiveMaximum?: number | boolean
  maxItems?: number
  maxLength?: number
  description?: string
  title?: string
  format?: string
  nullable?: boolean
  deprecated?: boolean
  properties?: Record<string, JsonSchema>
  required?: string[]
  items?: JsonSchema
  allOf?: JsonSchema[]
  anyOf?: JsonSchema[]
  oneOf?: JsonSchema[]
}

interface OpenApiOperation {
  requestBody?: { content?: Record<string, { schema?: JsonSchema }> }
}

export interface OpenApiDoc {
  paths?: Record<string, { post?: OpenApiOperation }>
  components?: { schemas?: Record<string, JsonSchema> }
  'x-comfy-router-input-modalities'?: string[]
  'x-comfy-router-output-modalities'?: string[]
  'x-comfy-input-schema-authored'?: boolean
}

export type RouterEncoding = 'base64' | 'dataUrl' | 'url'

export type RouterShape =
  | 'flat'
  | 'anthropicMessages'
  | 'openaiChat'
  | 'openaiResponses'
  | 'geminiContents'

export type RouterTransport = 'queue' | 'sync'

export interface RouterPortSpec extends PortSpec {
  encoding?: RouterEncoding
  field?: string
  numbered?: string[]
}

export interface FixedValue {
  path: string[]
  value: JsonValue
}

export interface RouterContract {
  modelId: string
  version: string
  modality: Modality
  shape: RouterShape | 'family'
  family?: string
  transport: RouterTransport
  promptField?: string
  inputs: RouterPortSpec[]
  output: PortSpec
  settings: SettingSpec[]
  settingPaths: Partial<Record<string, string[]>>
  fixed: FixedValue[]
}

export type RouterContractOutcome =
  | { ok: true; contract: RouterContract }
  | { ok: false; reason: 'unsupportedShape' | 'notAuthored' }

export interface EncodedMedia {
  data: string
  mime: string
}

export interface EncodedInputs {
  text: Partial<Record<string, string>>
  media: Partial<Record<string, EncodedMedia[]>>
}

export type RawRouterOutput =
  | { kind: 'text'; text: string }
  | { kind: 'base64'; data: string; mime: string }
  | { kind: 'url'; url: string }
  | { kind: 'blob'; blob: Blob }

export type BodyOutcome =
  | { ok: true; body: JsonObject }
  | { ok: false; reason: 'needsFirstFrame' }

export type OutputsOutcome =
  | { ok: true; outputs: RawRouterOutput[] }
  | { ok: false; message?: string }

interface FamilyBodyInput {
  inputs: EncodedInputs
  values: Record<string, SettingValue>
}

export interface RouterFamily {
  id: string
  matches(modelId: string): boolean
  transport: RouterTransport
  ports(doc: OpenApiDoc): RouterPortSpec[]
  settingsRoots: readonly string[][]
  excludeSettings: readonly string[]
  extraSettings: readonly SettingSpec[]
  fixed: readonly FixedValue[]
  buildBody(input: FamilyBodyInput): BodyOutcome
  readResult(json: unknown): OutputsOutcome
}
