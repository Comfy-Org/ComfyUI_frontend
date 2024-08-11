import { z } from 'zod'
import { fromZodError } from 'zod-validation-error'

// GroupNode is hacking node id to be a string, so we need to allow that.
// innerNode.id = `${this.node.id}:${i}`
// Remove it after GroupNode is redesigned.
export const zNodeId = z.union([z.number().int(), z.string()])
export const zSlotIndex = z.union([
  z.number().int(),
  z
    .string()
    .transform((val) => parseInt(val))
    .refine((val) => !isNaN(val), {
      message: 'Invalid number'
    })
])

// TODO: Investigate usage of array and number as data type usage in custom nodes.
// Known usage:
// - https://github.com/rgthree/rgthree-comfy Context Big node is using array as type.
export const zDataType = z.union([z.string(), z.array(z.string()), z.number()])

// Definition of an AI model file used in the workflow.
const zModelFile = z.object({
  name: z.string(),
  url: z.string().url(),
  hash: z.string(),
  hash_type: z.string(),
  directory: z.string()
})

const zComfyLink = z.tuple([
  z.number(), // Link id
  zNodeId, // Node id of source node
  zSlotIndex, // Output slot# of source node
  zNodeId, // Node id of destination node
  zSlotIndex, // Input slot# of destination node
  zDataType // Data type
])

const zNodeOutput = z
  .object({
    name: z.string(),
    type: zDataType,
    links: z.array(z.number()).nullable(),
    slot_index: zSlotIndex.optional()
  })
  .passthrough()

const zNodeInput = z
  .object({
    name: z.string(),
    type: zDataType,
    link: z.number().nullable(),
    slot_index: zSlotIndex.optional()
  })
  .passthrough()

const zFlags = z
  .object({
    collapsed: z.boolean().optional(),
    pinned: z.boolean().optional(),
    allow_interaction: z.boolean().optional(),
    horizontal: z.boolean().optional(),
    skip_repeated_outputs: z.boolean().optional()
  })
  .passthrough()

const zProperties = z
  .object({
    ['Node name for S&R']: z.string().optional()
  })
  .passthrough()

const zVector2 = z.union([
  z.object({ 0: z.number(), 1: z.number() }).transform((v) => [v[0], v[1]]),
  z.tuple([z.number(), z.number()])
])

const zWidgetValues = z.union([z.array(z.any()), z.record(z.any())])

const zComfyNode = z
  .object({
    id: zNodeId,
    type: z.string(),
    pos: zVector2,
    size: zVector2,
    flags: zFlags,
    order: z.number(),
    mode: z.number(),
    inputs: z.array(zNodeInput).optional(),
    outputs: z.array(zNodeOutput).optional(),
    properties: zProperties,
    widgets_values: zWidgetValues.optional(),
    color: z.string().optional(),
    bgcolor: z.string().optional()
  })
  .passthrough()

const zGroup = z
  .object({
    title: z.string(),
    bounding: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    color: z.string().optional(),
    font_size: z.number().optional(),
    locked: z.boolean().optional()
  })
  .passthrough()

const zInfo = z
  .object({
    name: z.string(),
    author: z.string(),
    description: z.string(),
    version: z.string(),
    created: z.string(),
    modified: z.string(),
    software: z.string()
  })
  .passthrough()

const zDS = z
  .object({
    scale: z.number(),
    offset: zVector2
  })
  .passthrough()

const zConfig = z
  .object({
    links_ontop: z.boolean().optional(),
    align_to_grid: z.boolean().optional()
  })
  .passthrough()

const zExtra = z
  .object({
    ds: zDS.optional(),
    info: zInfo.optional()
  })
  .passthrough()

export const zComfyWorkflow = z
  .object({
    last_node_id: zNodeId,
    last_link_id: z.number(),
    nodes: z.array(zComfyNode),
    links: z.array(zComfyLink),
    groups: z.array(zGroup).optional(),
    config: zConfig.optional().nullable(),
    extra: zExtra.optional().nullable(),
    version: z.number(),
    models: z.array(zModelFile).optional()
  })
  .passthrough()

export type NodeInput = z.infer<typeof zNodeInput>
export type NodeOutput = z.infer<typeof zNodeOutput>
export type ComfyLink = z.infer<typeof zComfyLink>
export type ComfyNode = z.infer<typeof zComfyNode>
export type ComfyWorkflowJSON = z.infer<typeof zComfyWorkflow>

export async function validateComfyWorkflow(
  data: any,
  onError: (error: string) => void = console.warn
): Promise<ComfyWorkflowJSON | null> {
  const result = await zComfyWorkflow.safeParseAsync(data)
  if (!result.success) {
    const error = fromZodError(result.error)
    onError(`Invalid workflow against zod schema:\n${error}`)
    return null
  }
  return result.data
}
