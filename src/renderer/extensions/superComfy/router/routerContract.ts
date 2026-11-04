import { compact, groupBy, pick, sortBy } from 'es-toolkit'

import type {
  FileModality,
  GenerateContract,
  Modality,
  PortSpec
} from '@/renderer/extensions/superComfy/engine/documentSchema'
import { stableKey } from '@/renderer/extensions/superComfy/engine/stableKey'
import { findRouterFamily } from '@/renderer/extensions/superComfy/router/routerFamilies'
import {
  humanizeKey,
  mediaPort,
  outputPort,
  textPort
} from '@/renderer/extensions/superComfy/router/routerPorts'
import {
  componentSchema,
  derefSchema,
  flattenSchema,
  inputModalities,
  isNullSchema,
  primaryModality,
  propertiesOf,
  reachableSchemas,
  requestSchemaOf,
  schemaType
} from '@/renderer/extensions/superComfy/router/routerSchema'
import type {
  ExtraSetting,
  SettingSource
} from '@/renderer/extensions/superComfy/router/routerSettings'
import { deriveSettings } from '@/renderer/extensions/superComfy/router/routerSettings'
import type {
  FixedValue,
  JsonSchema,
  OpenApiDoc,
  RouterContract,
  RouterContractOutcome,
  RouterEncoding,
  RouterFamily,
  RouterPortSpec,
  RouterShape,
  RouterTransport
} from '@/renderer/extensions/superComfy/router/routerTypes'

type ChatShape = Exclude<RouterShape, 'flat'>
type MediaModality = Extract<FileModality, 'image' | 'video' | 'audio'>
type MediaSlot = MediaModality | 'last_frame'

interface ContractParts {
  shape: RouterShape | 'family'
  family?: string
  transport: RouterTransport
  promptField?: string
  inputs: RouterPortSpec[]
  settings: RouterContract['settings']
  settingPaths: RouterContract['settingPaths']
  fixed: FixedValue[]
}

interface MediaShape {
  multi: boolean
  max?: number
  text: string
  format?: string
}

interface MediaField {
  key: string
  modality: MediaModality
  slot: MediaSlot
  shape: MediaShape
  encoding: RouterEncoding
  required: boolean
}

interface MediaGroup {
  base: MediaField
  keys: string[]
}

interface ChatShapeRules {
  encoding: RouterEncoding
  maxImages?: number
  systemKey?: string
  structural: readonly string[]
}

export interface RouterModelSummary {
  id: string
  etag: string | null
  primary: Modality | null
  status: 'supported' | 'unsupported' | 'hidden'
}

const CONTRACT_REVISION = 1
const MEDIA_NAME = /image|frame|reference|ref_|video|audio/i
const NOT_MEDIA_NAME =
  /mask|callback|webhook|_format$|_size$|_strength$|_count$|^num_/i
const LAST_FRAME_NAME = /last_frame|end_image|end_frame|tail_image/i
const NUMBERED_NAME = /^(.+)_(\d+)$/
const SYSTEM_FIELDS = ['system', 'system_prompt', 'instructions']
const SLOT_ORDER: readonly MediaSlot[] = [
  'image',
  'last_frame',
  'video',
  'audio'
]
const REASONING_EFFORTS = ['low', 'medium', 'high']
const GEMINI_IMAGE_MODALITIES = ['TEXT', 'IMAGE']

const CHAT_RULES: Record<ChatShape, ChatShapeRules> = {
  anthropicMessages: {
    encoding: 'base64',
    maxImages: 20,
    systemKey: 'system',
    structural: ['messages', 'system']
  },
  openaiChat: { encoding: 'dataUrl', structural: ['messages'] },
  openaiResponses: {
    encoding: 'dataUrl',
    systemKey: 'instructions',
    structural: ['input', 'instructions', 'reasoning']
  },
  geminiContents: {
    encoding: 'base64',
    maxImages: 14,
    systemKey: 'systemInstruction',
    structural: []
  }
}

const SUMMARY_STATUS: Record<
  'unsupportedShape' | 'notAuthored',
  RouterModelSummary['status']
> = {
  unsupportedShape: 'unsupported',
  notAuthored: 'hidden'
}

function hasProperty(schema: JsonSchema, key: string): boolean {
  return Object.hasOwn(schema.properties ?? {}, key)
}

function isStringProperty(
  doc: OpenApiDoc,
  schema: JsonSchema,
  key: string
): boolean {
  const property = schema.properties?.[key]
  return (
    hasProperty(schema, key) &&
    property !== undefined &&
    schemaType(flattenSchema(doc, property)) === 'string'
  )
}

function detectShape(doc: OpenApiDoc, request: JsonSchema): RouterShape | null {
  const has = (key: string) => hasProperty(request, key)
  if (has('messages') && has('max_tokens')) return 'anthropicMessages'
  if (has('input')) return 'openaiResponses'
  if (has('messages')) return 'openaiChat'
  if (has('contents')) return 'geminiContents'
  if (isStringProperty(doc, request, 'prompt')) return 'flat'
  if (!has('prompt') && isStringProperty(doc, request, 'text')) return 'flat'
  return null
}

function detectEncoding(
  text: string,
  format: string | undefined
): RouterEncoding {
  if (/data[ -]?ur[il]|data:/i.test(text)) return 'dataUrl'
  if (/base64/i.test(text)) return 'base64'
  if (format === 'uri' || /\bur[il]s?\b/i.test(text)) return 'url'
  return 'dataUrl'
}

function isPlainString(schema: JsonSchema | null): boolean {
  return (
    schema !== null && schemaType(schema) === 'string' && !schema.enum?.length
  )
}

function unionBranches(doc: OpenApiDoc, schema: JsonSchema): JsonSchema[] {
  const union = schema.anyOf ?? schema.oneOf
  const branches =
    union?.length && !schema.properties
      ? union.map((branch) => flattenSchema(doc, branch))
      : [schema]
  return branches.filter((branch) => !isNullSchema(branch))
}

function arrayItems(doc: OpenApiDoc, schema: JsonSchema): JsonSchema | null {
  return schema.items ? flattenSchema(doc, schema.items) : null
}

function mediaShapeOf(doc: OpenApiDoc, raw: JsonSchema): MediaShape | null {
  const schema = derefSchema(doc, raw)
  const branches = unionBranches(doc, schema)
  const arrays = branches.filter((branch) => schemaType(branch) === 'array')
  const strings = branches.filter(isPlainString)
  const items = arrays.map((branch) => arrayItems(doc, branch))
  if (branches.length === 0) return null
  if (strings.length + arrays.length !== branches.length) return null
  if (!items.every(isPlainString)) return null
  const described = [schema, ...branches, ...compact(items)]
  return {
    multi: arrays.length > 0,
    max: arrays[0]?.maxItems,
    text: compact(described.map(({ description }) => description)).join(' '),
    format: described.find(({ format }) => format !== undefined)?.format
  }
}

function fieldModality(key: string): MediaModality {
  if (/video/i.test(key)) return 'video'
  if (/audio/i.test(key)) return 'audio'
  return 'image'
}

function slotOf(key: string, modality: MediaModality): MediaSlot {
  return modality === 'image' && LAST_FRAME_NAME.test(key)
    ? 'last_frame'
    : modality
}

function isMediaCandidate(key: string, consumed: ReadonlySet<string>) {
  return !consumed.has(key) && MEDIA_NAME.test(key) && !NOT_MEDIA_NAME.test(key)
}

function mediaFields(
  doc: OpenApiDoc,
  request: JsonSchema,
  consumed: ReadonlySet<string>
): MediaField[] {
  const modalities = inputModalities(doc)
  const required = new Set(request.required ?? [])
  return propertiesOf(request).flatMap(([key, schema]) => {
    const modality = fieldModality(key)
    if (!isMediaCandidate(key, consumed) || !modalities.has(modality)) return []
    const shape = mediaShapeOf(doc, schema)
    if (!shape) return []
    return [
      {
        key,
        modality,
        slot: slotOf(key, modality),
        shape,
        encoding: detectEncoding(shape.text, shape.format),
        required: required.has(key)
      }
    ]
  })
}

function numberSuffix(key: string): number {
  const match = NUMBERED_NAME.exec(key)
  return match ? Number(match[2]) : 1
}

function groupNumbered(fields: readonly MediaField[]): MediaGroup[] {
  const byKey = new Map(fields.map((field) => [field.key, field]))
  const baseOf = (key: string) => {
    const match = NUMBERED_NAME.exec(key)
    return match && byKey.has(match[1]) ? match[1] : key
  }
  const grouped = groupBy(fields, (field) => baseOf(field.key))
  return Object.entries(grouped).map(([base, members]) => ({
    base: byKey.get(base) ?? members[0],
    keys: sortBy(members, [(member) => numberSuffix(member.key)]).map(
      (member) => member.key
    )
  }))
}

function groupMax({ base, keys }: MediaGroup): number | undefined {
  if (keys.length > 1) return keys.length
  return base.shape.multi ? base.shape.max : 1
}

function groupPort(group: MediaGroup, name: string): RouterPortSpec {
  return mediaPort({
    name,
    modality: group.base.modality,
    encoding: group.base.encoding,
    required: group.base.required,
    max: groupMax(group),
    field: group.base.key,
    numbered: group.keys.length > 1 ? group.keys : undefined
  })
}

function mediaPorts(groups: readonly MediaGroup[]): RouterPortSpec[] {
  const bySlot = groupBy(groups, (group) => group.base.slot)
  return SLOT_ORDER.flatMap((slot) =>
    (Object.hasOwn(bySlot, slot) ? bySlot[slot] : []).map((group, index) =>
      groupPort(group, index === 0 ? slot : `${slot}_${index + 1}`)
    )
  )
}

function flatParts(
  doc: OpenApiDoc,
  request: JsonSchema,
  modelId: string,
  modality: Modality
): ContractParts {
  const required = new Set(request.required ?? [])
  const promptField = isStringProperty(doc, request, 'prompt')
    ? 'prompt'
    : 'text'
  const negative = isStringProperty(doc, request, 'negative_prompt')
  const systemField = SYSTEM_FIELDS.find((key) =>
    isStringProperty(doc, request, key)
  )
  const textFields = compact([
    promptField,
    negative && 'negative_prompt',
    systemField
  ])
  const media = mediaFields(doc, request, new Set(textFields))
  const derived = deriveSettings(doc, request, [
    { root: [], exclude: new Set([...textFields, ...media.map((f) => f.key)]) }
  ])
  return {
    shape: 'flat',
    transport: transportFor(modelId, modality),
    promptField,
    inputs: [
      textPort('prompt', {
        required: required.has(promptField),
        field: promptField
      }),
      ...(negative
        ? [textPort('negative_prompt', { field: 'negative_prompt' })]
        : []),
      ...(systemField ? [textPort('system', { field: systemField })] : []),
      ...mediaPorts(groupNumbered(media))
    ],
    ...derived
  }
}

function chatPorts(
  shape: ChatShape,
  doc: OpenApiDoc,
  request: JsonSchema
): RouterPortSpec[] {
  const rules = CHAT_RULES[shape]
  const hasSystem =
    rules.systemKey === undefined || hasProperty(request, rules.systemKey)
  const takesImages = inputModalities(doc).has('image')
  return [
    textPort('prompt', { required: true }),
    ...(hasSystem ? [textPort('system')] : []),
    ...(takesImages
      ? [
          mediaPort({
            name: 'image',
            modality: 'image',
            encoding: rules.encoding,
            max: rules.maxImages
          })
        ]
      : [])
  ]
}

function chatSources(
  shape: ChatShape,
  modality: Modality
): readonly SettingSource[] {
  const exclude = new Set(CHAT_RULES[shape].structural)
  if (shape !== 'geminiContents') return [{ root: [], exclude }]
  const generation: SettingSource = { root: ['generationConfig'], exclude }
  if (modality !== 'image') return [generation]
  return [generation, { root: ['generationConfig', 'imageConfig'], exclude }]
}

function reasoningEffort(doc: OpenApiDoc, request: JsonSchema): ExtraSetting[] {
  if (!hasProperty(request, 'reasoning')) return []
  const declared = componentSchema(doc, 'ReasoningEffort')?.enum?.filter(
    (value): value is string => typeof value === 'string'
  )
  return [
    {
      spec: {
        control: 'select',
        name: 'effort',
        label: humanizeKey('effort'),
        options: declared?.length ? declared : REASONING_EFFORTS,
        required: false
      },
      path: ['reasoning', 'effort']
    }
  ]
}

function chatFixed(shape: ChatShape, modality: Modality): FixedValue[] {
  if (shape !== 'geminiContents' || modality !== 'image') return []
  return [
    {
      path: ['generationConfig', 'responseModalities'],
      value: GEMINI_IMAGE_MODALITIES
    }
  ]
}

function chatParts(
  shape: ChatShape,
  doc: OpenApiDoc,
  request: JsonSchema,
  modelId: string,
  modality: Modality
): ContractParts {
  const extras =
    shape === 'openaiResponses' ? reasoningEffort(doc, request) : []
  const derived = deriveSettings(
    doc,
    request,
    chatSources(shape, modality),
    extras
  )
  return {
    shape,
    transport: transportFor(modelId, modality),
    inputs: chatPorts(shape, doc, request),
    settings: derived.settings,
    settingPaths: derived.settingPaths,
    fixed: [...derived.fixed, ...chatFixed(shape, modality)]
  }
}

function familyParts(
  family: RouterFamily,
  doc: OpenApiDoc,
  request: JsonSchema
): ContractParts {
  const exclude = new Set(family.excludeSettings)
  const derived = deriveSettings(
    doc,
    request,
    family.settingsRoots.map((root) => ({ root, exclude })),
    family.extraSettings.map((spec) => ({ spec }))
  )
  return {
    shape: 'family',
    family: family.id,
    transport: family.transport,
    inputs: family.ports(doc),
    settings: derived.settings,
    settingPaths: derived.settingPaths,
    fixed: [...derived.fixed, ...family.fixed]
  }
}

function transportFor(modelId: string, modality: Modality): RouterTransport {
  return modality === 'text' || modelId.startsWith('elevenlabs/')
    ? 'sync'
    : 'queue'
}

function contractParts(
  modelId: string,
  doc: OpenApiDoc,
  request: JsonSchema,
  modality: Modality
): ContractParts | null {
  const family = findRouterFamily(modelId)
  if (family) return familyParts(family, doc, request)
  const shape = detectShape(doc, request)
  if (shape === null) return null
  if (shape === 'flat') return flatParts(doc, request, modelId, modality)
  return chatParts(shape, doc, request, modelId, modality)
}

export function deriveRouterContract(
  modelId: string,
  doc: OpenApiDoc,
  modality: Modality
): RouterContractOutcome {
  if (doc['x-comfy-input-schema-authored'] === false) {
    return { ok: false, reason: 'notAuthored' }
  }
  const raw = requestSchemaOf(doc)
  if (!raw) return { ok: false, reason: 'unsupportedShape' }
  const parts = contractParts(modelId, doc, flattenSchema(doc, raw), modality)
  if (!parts) return { ok: false, reason: 'unsupportedShape' }
  return {
    ok: true,
    contract: {
      modelId,
      version: stableKey([CONTRACT_REVISION, raw, reachableSchemas(doc, raw)]),
      modality,
      output: outputPort(modality),
      ...parts
    }
  }
}

function toPortSpec(port: RouterPortSpec): PortSpec {
  return pick(port, [
    'name',
    'label',
    'modality',
    'required',
    'multi',
    'max',
    'inline'
  ])
}

export function toGenerateContract(contract: RouterContract): GenerateContract {
  return {
    version: contract.version,
    inputs: contract.inputs.map(toPortSpec),
    outputs: [contract.output],
    settings: contract.settings
  }
}

export function summarizeRouterSchema(
  id: string,
  etag: string | null,
  doc: OpenApiDoc
): RouterModelSummary {
  const primary = primaryModality(doc['x-comfy-router-output-modalities'] ?? [])
  if (!primary) return { id, etag, primary, status: 'hidden' }
  const outcome = deriveRouterContract(id, doc, primary)
  return {
    id,
    etag,
    primary,
    status: outcome.ok ? 'supported' : SUMMARY_STATUS[outcome.reason]
  }
}
