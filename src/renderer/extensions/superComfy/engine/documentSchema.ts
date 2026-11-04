import { z } from 'zod'

export const zModality = z.enum(['image', 'video', 'audio', 'text', '3d'])
const zFileModality = z.enum(['image', 'video', 'audio', '3d'])
const zSettingValue = z.union([z.string(), z.number(), z.boolean()])

const zComfyFileRef = z.object({
  filename: z.string(),
  subfolder: z.string(),
  type: z.enum(['input', 'output', 'temp'])
})

const zMediaItem = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), text: z.string() }),
  z.object({
    kind: z.literal('file'),
    modality: zFileModality,
    ref: zComfyFileRef,
    mime: z.string().optional()
  }),
  z.object({
    kind: z.literal('link'),
    modality: zFileModality,
    url: z.string(),
    expiresAt: z.number(),
    mime: z.string().optional()
  })
])

const zPortSpec = z.object({
  name: z.string(),
  label: z.string(),
  modality: zModality,
  required: z.boolean(),
  multi: z.boolean(),
  max: z.number().int().positive().optional(),
  inline: z.boolean().optional()
})

const zSettingSpec = z.discriminatedUnion('control', [
  z.object({
    control: z.literal('select'),
    name: z.string(),
    label: z.string(),
    options: z.array(z.union([z.string(), z.number()])),
    default: z.union([z.string(), z.number()]).optional(),
    required: z.boolean()
  }),
  z.object({
    control: z.literal('number'),
    name: z.string(),
    label: z.string(),
    integer: z.boolean(),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().optional(),
    default: z.number().optional(),
    required: z.boolean()
  }),
  z.object({
    control: z.literal('toggle'),
    name: z.string(),
    label: z.string(),
    default: z.boolean().optional(),
    required: z.boolean()
  }),
  z.object({
    control: z.literal('text'),
    name: z.string(),
    label: z.string(),
    multiline: z.boolean(),
    default: z.string().optional(),
    required: z.boolean()
  })
])

const zWidgetTarget = z.object({
  nodeId: z.string(),
  widgetName: z.string()
})

const zGenerateContract = z.object({
  version: z.string(),
  inputs: z.array(zPortSpec),
  outputs: z.array(zPortSpec),
  settings: z.array(zSettingSpec)
})

const zAppContract = z.object({
  version: z.number(),
  inputs: z.array(
    zPortSpec.extend({ target: zWidgetTarget, default: z.string().optional() })
  ),
  outputs: z.array(zPortSpec.extend({ outputNodeId: z.string() })),
  settings: z.array(
    z.intersection(zSettingSpec, z.object({ target: zWidgetTarget }))
  ),
  dropped: z.number().int().nonnegative()
})

const zNodeBase = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number()
})

const zRunRecord = z.object({
  key: z.string(),
  index: z.number().int().nonnegative(),
  outputs: z.record(z.string(), z.array(zMediaItem)),
  finishedAt: z.number(),
  creditsUsed: z.number().optional(),
  notice: z.string().optional()
})

const zRunFailureCode = z.enum(['noOutput', 'threw'])

const zRunFailure = z.object({
  key: z.string(),
  index: z.number().int().nonnegative(),
  message: z.string().optional(),
  code: zRunFailureCode.optional()
})

const zNodeResult = z.object({
  planKeys: z.array(z.string()),
  outputs: z.record(z.string(), z.array(zMediaItem)),
  failures: z.array(zRunFailure),
  status: z.enum(['complete', 'partial', 'failed']),
  finishedAt: z.number()
})

const zIoNode = zNodeBase.extend({
  kind: z.literal('io'),
  modality: zModality,
  items: z.array(zMediaItem)
})

const zExecutableBase = zNodeBase.extend({
  runCount: z.number().int().min(1),
  settingsOpen: z.boolean(),
  values: z.record(z.string(), zSettingValue),
  inline: z.record(z.string(), z.string()),
  runs: z.record(z.string(), zRunRecord),
  result: zNodeResult.nullable()
})

const zGenerateNode = zExecutableBase.extend({
  kind: z.literal('generate'),
  modality: zModality,
  modelId: z.string().nullable(),
  modelLabel: z.string().nullable(),
  contract: zGenerateContract.nullable()
})

const zAppNode = zExecutableBase.extend({
  kind: z.literal('app'),
  workflowPath: z.string(),
  title: z.string(),
  contract: zAppContract.nullable()
})

const zSuperNode = z.discriminatedUnion('kind', [
  zIoNode,
  zGenerateNode,
  zAppNode
])

const zPortRef = z.object({ node: z.string(), port: z.string() })

const zSuperEdge = z.object({
  id: z.string(),
  seq: z.number().int().nonnegative(),
  from: zPortRef,
  to: zPortRef
})

const zSuperGraphDocument = z.object({
  version: z.literal(1),
  savedAt: z.number(),
  nodes: z.array(zSuperNode),
  edges: z.array(zSuperEdge),
  nextSeq: z.number().int().nonnegative(),
  viewport: z.object({ x: z.number(), y: z.number(), zoom: z.number() })
})

export type Modality = z.infer<typeof zModality>
export type FileModality = z.infer<typeof zFileModality>
export type NodeId = string
export type EdgeId = string
export type RunKey = string
export type SessionId = string
export type SettingValue = z.infer<typeof zSettingValue>
export type ComfyFileRef = z.infer<typeof zComfyFileRef>
export type MediaItem = z.infer<typeof zMediaItem>
export type PortSpec = z.infer<typeof zPortSpec>
export type SettingSpec = z.infer<typeof zSettingSpec>
export type WidgetTarget = z.infer<typeof zWidgetTarget>
export type GenerateContract = z.infer<typeof zGenerateContract>
export type AppContract = z.infer<typeof zAppContract>
export type IoNode = z.infer<typeof zIoNode>
export type RunRecord = z.infer<typeof zRunRecord>
export type RunFailureCode = z.infer<typeof zRunFailureCode>
export type RunFailure = z.infer<typeof zRunFailure>
export type NodeResult = z.infer<typeof zNodeResult>
export type GenerateNode = z.infer<typeof zGenerateNode>
export type AppNode = z.infer<typeof zAppNode>
export type ExecutableNode = GenerateNode | AppNode
export type SuperNode = z.infer<typeof zSuperNode>
export type PortRef = z.infer<typeof zPortRef>
export type SuperEdge = z.infer<typeof zSuperEdge>
export type SuperGraphDocument = z.infer<typeof zSuperGraphDocument>

export function emptyDocument(): SuperGraphDocument {
  return {
    version: 1,
    savedAt: 0,
    nodes: [],
    edges: [],
    nextSeq: 0,
    viewport: { x: 0, y: 0, zoom: 1 }
  }
}

export function parseSuperGraphDocument(
  raw: unknown
): { ok: true; doc: SuperGraphDocument } | { ok: false; issues: string[] } {
  const parsed = zSuperGraphDocument.safeParse(raw)
  if (parsed.success) return { ok: true, doc: parsed.data }
  return {
    ok: false,
    issues: parsed.error.issues.map(
      (issue) =>
        `${issue.path.map(String).join('.') || '(root)'}: ${issue.message}`
    )
  }
}
