import { type SafeParseReturnType, z } from 'zod'
import { fromZodError } from 'zod-validation-error'

// GroupNode is hacking node id to be a string, so we need to allow that.
// innerNode.id = `${this.node.id}:${i}`
// Remove it after GroupNode is redesigned.
export const zNodeId = z.union([z.number().int(), z.string()])
export const zNodeInputName = z.string()
export type NodeId = z.infer<typeof zNodeId>
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

const zVector2 = z.union([
  z
    .object({ 0: z.number(), 1: z.number() })
    .passthrough()
    .transform((v) => [v[0], v[1]] as [number, number]),
  z.tuple([z.number(), z.number()])
])

// Definition of an AI model file used in the workflow.
const zModelFile = z.object({
  name: z.string(),
  url: z.string().url(),
  hash: z.string().optional(),
  hash_type: z.string().optional(),
  directory: z.string()
})

const zGraphState = z
  .object({
    lastGroupId: z.number(),
    lastNodeId: z.number(),
    lastLinkId: z.number(),
    lastRerouteId: z.number()
  })
  .passthrough()

const zComfyLink = z.tuple([
  z.number(), // Link id
  zNodeId, // Node id of source node
  zSlotIndex, // Output slot# of source node
  zNodeId, // Node id of destination node
  zSlotIndex, // Input slot# of destination node
  zDataType // Data type
])

/** Extension to 0.4 schema (links as arrays): parent reroute ID */
const zComfyLinkExtension = z
  .object({
    id: z.number(),
    parentId: z.number()
  })
  .passthrough()

const zComfyLinkObject = z
  .object({
    id: z.number(),
    origin_id: zNodeId,
    origin_slot: zSlotIndex,
    target_id: zNodeId,
    target_slot: zSlotIndex,
    type: zDataType,
    parentId: z.number().optional()
  })
  .passthrough()

const zReroute = z
  .object({
    id: z.number(),
    parentId: z.number().optional(),
    pos: zVector2,
    linkIds: z.array(z.number()).nullish(),
    floating: z
      .object({
        slotType: z.enum(['input', 'output'])
      })
      .optional()
  })
  .passthrough()

const zNodeOutput = z
  .object({
    name: z.string(),
    type: zDataType,
    links: z.array(z.number()).nullable().optional(),
    slot_index: zSlotIndex.optional()
  })
  .passthrough()

const zNodeInput = z
  .object({
    name: zNodeInputName,
    type: zDataType,
    link: z.number().nullable().optional(),
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

const repoLikeIdPattern = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?$/
const githubUsernamePattern = /^(?!-)(?!.*--)[a-zA-Z0-9-]+(?<!-)$/
const gitHashPattern = /^[0-9a-f]{4,40}$/i
const semverPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\da-z-]+(?:\.[\da-z-]+)*))?(?:\+([\da-z-]+(?:\.[\da-z-]+)*))?$/

// Shared schema for Comfy Node Registry IDs and GitHub repo names
const zRepoLikeId = z
  .string()
  .min(1)
  .max(100)
  .regex(repoLikeIdPattern, {
    message: "ID can only contain ASCII letters, digits, '_', '-', and '.'"
  })
  .refine((id) => !/^[_\-.]|[_\-.]$/.test(id), {
    message: "ID must not start or end with '_', '-', or '.'"
  })

const zCnrId = zRepoLikeId
const zGithubRepoName = zRepoLikeId

// GitHub username/organization schema
const zGithubUsername = z
  .string()
  .min(1)
  .max(39)
  .regex(githubUsernamePattern, 'Invalid GitHub username/org')

// Auxiliary ID identifies node packs not installed via the Comfy Node Registry
const zAuxId = z
  .string()
  .regex(/^[^/]+\/[^/]+$/, "Invalid format. Must be 'github-user/repo-name'")
  .transform((id) => id.split('/'))
  .refine(
    ([username, repo]) =>
      zGithubUsername.safeParse(username).success &&
      zGithubRepoName.safeParse(repo).success,
    "Invalid aux_id: Must be valid 'github-username/github-repo-name'"
  )
  .transform(([username, repo]) => `${username}/${repo}`)

const zGitHash = z.string().superRefine((val: string, ctx) => {
  if (!gitHashPattern.test(val)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Node pack version has invalid Git commit hash: "${val}"`
    })
  }
})
const zSemVer = z.string().superRefine((val: string, ctx) => {
  if (!semverPattern.test(val)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Node pack version has invalid semantic version: "${val}"`
    })
  }
})
const zVersion = z.union([
  z
    .string()
    .transform((ver) => ver.replace(/^v/, '')) // Strip leading 'v'
    .pipe(z.union([zSemVer, zGitHash])),
  z.literal('unknown')
])

const zProperties = z
  .object({
    ['Node name for S&R']: z.string().optional(),
    cnr_id: zCnrId.optional(),
    aux_id: zAuxId.optional(),
    ver: zVersion.optional(),
    models: z.array(zModelFile).optional()
  })
  .passthrough()

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

export const zSubgraphIO = zNodeInput.extend({
  /** Slot ID (internal; never changes once instantiated). */
  id: z.string().uuid(),
  /** The data type this slot uses. Unlike nodes, this does not support legacy numeric types. */
  type: z.string(),
  /** Links connected to this slot, or `undefined` if not connected. An ouptut slot should only ever have one link. */
  linkIds: z.array(z.number()).optional()
})

const zSubgraphInstance = z
  .object({
    id: zNodeId,
    type: z.string().uuid(),
    pos: zVector2,
    size: zVector2,
    flags: zFlags,
    order: z.number(),
    mode: z.number(),
    inputs: z.array(zSubgraphIO).optional(),
    outputs: z.array(zSubgraphIO).optional(),
    widgets_values: zWidgetValues.optional(),
    color: z.string().optional(),
    bgcolor: z.string().optional()
  })
  .passthrough()

const zGroup = z
  .object({
    id: z.number().optional(),
    title: z.string(),
    bounding: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    color: z.string().optional(),
    font_size: z.number().optional(),
    locked: z.boolean().optional()
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
    frontendVersion: z.string().optional(),
    linkExtensions: z.array(zComfyLinkExtension).optional(),
    reroutes: z.array(zReroute).optional()
  })
  .passthrough()

export const zGraphDefinitions = z.object({
  subgraphs: z.lazy(() => z.array(zSubgraphDefinition))
})

export const zBaseExportableGraph = z.object({
  /** Unique graph ID.  Automatically generated if not provided. */
  id: z.string().uuid().optional(),
  revision: z.number().optional(),
  config: zConfig.optional().nullable(),
  /** Details of the appearance and location of subgraphs shown in this graph. Similar to */
  subgraphs: z.array(zSubgraphInstance).optional()
})

/** Schema version 0.4 */
export const zComfyWorkflow = zBaseExportableGraph
  .extend({
    id: z.string().uuid().optional(),
    revision: z.number().optional(),
    last_node_id: zNodeId,
    last_link_id: z.number(),
    nodes: z.array(zComfyNode),
    links: z.array(zComfyLink),
    floatingLinks: z.array(zComfyLinkObject).optional(),
    groups: z.array(zGroup).optional(),
    config: zConfig.optional().nullable(),
    extra: zExtra.optional().nullable(),
    version: z.number(),
    models: z.array(zModelFile).optional(),
    definitions: zGraphDefinitions.optional()
  })
  .passthrough()

/** Required for recursive definition of subgraphs. */
interface ComfyWorkflow1BaseType {
  id?: string
  revision?: number
  version: 1
  models?: z.infer<typeof zModelFile>[]
  state: z.infer<typeof zGraphState>
}

/** Required for recursive definition of subgraphs w/ZodEffects. */
interface ComfyWorkflow1BaseInput extends ComfyWorkflow1BaseType {
  groups?: z.input<typeof zGroup>[]
  nodes: z.input<typeof zComfyNode>[]
  links?: z.input<typeof zComfyLinkObject>[]
  floatingLinks?: z.input<typeof zComfyLinkObject>[]
  reroutes?: z.input<typeof zReroute>[]
  definitions?: {
    subgraphs: SubgraphDefinitionBase<ComfyWorkflow1BaseInput>[]
  }
}

/** Required for recursive definition of subgraphs w/ZodEffects. */
interface ComfyWorkflow1BaseOutput extends ComfyWorkflow1BaseType {
  groups?: z.output<typeof zGroup>[]
  nodes: z.output<typeof zComfyNode>[]
  links?: z.output<typeof zComfyLinkObject>[]
  floatingLinks?: z.output<typeof zComfyLinkObject>[]
  reroutes?: z.output<typeof zReroute>[]
  definitions?: {
    subgraphs: SubgraphDefinitionBase<ComfyWorkflow1BaseOutput>[]
  }
}

/** Schema version 1 */
export const zComfyWorkflow1 = zBaseExportableGraph
  .extend({
    id: z.string().uuid().optional(),
    revision: z.number().optional(),
    version: z.literal(1),
    config: zConfig.optional().nullable(),
    state: zGraphState,
    groups: z.array(zGroup).optional(),
    nodes: z.array(zComfyNode),
    links: z.array(zComfyLinkObject).optional(),
    floatingLinks: z.array(zComfyLinkObject).optional(),
    reroutes: z.array(zReroute).optional(),
    extra: zExtra.optional().nullable(),
    models: z.array(zModelFile).optional(),
    definitions: z
      .object({
        subgraphs: z.lazy(
          (): z.ZodArray<
            z.ZodType<
              SubgraphDefinitionBase<ComfyWorkflow1BaseOutput>,
              z.ZodTypeDef,
              SubgraphDefinitionBase<ComfyWorkflow1BaseInput>
            >,
            'many'
          > => z.array(zSubgraphDefinition)
        )
      })
      .optional()
  })
  .passthrough()

export const zExportedSubgraphIONode = z.object({
  id: zNodeId,
  bounding: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  pinned: z.boolean().optional()
})

export const zExposedWidget = z.object({
  id: z.string(),
  name: z.string()
})

interface SubgraphDefinitionBase<
  T extends ComfyWorkflow1BaseInput | ComfyWorkflow1BaseOutput
> {
  /** Unique graph ID.  Automatically generated if not provided. */
  id: string
  revision: number
  name: string

  inputNode: T extends ComfyWorkflow1BaseInput
    ? z.input<typeof zExportedSubgraphIONode>
    : z.output<typeof zExportedSubgraphIONode>
  outputNode: T extends ComfyWorkflow1BaseInput
    ? z.input<typeof zExportedSubgraphIONode>
    : z.output<typeof zExportedSubgraphIONode>
  /** Ordered list of inputs to the subgraph itself. Similar to a reroute, with the input side in the graph, and the output side in the subgraph. */
  inputs?: T extends ComfyWorkflow1BaseInput
    ? z.input<typeof zSubgraphIO>[]
    : z.output<typeof zSubgraphIO>[]
  /** Ordered list of outputs from the subgraph itself. Similar to a reroute, with the input side in the subgraph, and the output side in the graph. */
  outputs?: T extends ComfyWorkflow1BaseInput
    ? z.input<typeof zSubgraphIO>[]
    : z.output<typeof zSubgraphIO>[]
  /** A list of node widgets displayed in the parent graph, on the subgraph object. */
  widgets?: T extends ComfyWorkflow1BaseInput
    ? z.input<typeof zExposedWidget>[]
    : z.output<typeof zExposedWidget>[]
  definitions?: {
    subgraphs: SubgraphDefinitionBase<T>[]
  }
}

/** A subgraph definition `worfklow.definitions.subgraphs` */
export const zSubgraphDefinition = zComfyWorkflow1
  .extend({
    /** Unique graph ID.  Automatically generated if not provided. */
    id: z.string().uuid(),
    revision: z.number(),
    name: z.string(),
    inputNode: zExportedSubgraphIONode,
    outputNode: zExportedSubgraphIONode,

    /** Ordered list of inputs to the subgraph itself. Similar to a reroute, with the input side in the graph, and the output side in the subgraph. */
    inputs: z.array(zSubgraphIO).optional(),
    /** Ordered list of outputs from the subgraph itself. Similar to a reroute, with the input side in the subgraph, and the output side in the graph. */
    outputs: z.array(zSubgraphIO).optional(),
    /** A list of node widgets displayed in the parent graph, on the subgraph object. */
    widgets: z.array(zExposedWidget).optional(),
    definitions: z
      .object({
        subgraphs: z.lazy(
          (): z.ZodArray<
            z.ZodType<
              SubgraphDefinitionBase<ComfyWorkflow1BaseInput>,
              z.ZodTypeDef,
              SubgraphDefinitionBase<ComfyWorkflow1BaseInput>
            >,
            'many'
          > => zSubgraphDefinition.array()
        )
      })
      .optional()
  })
  .passthrough()

export type ModelFile = z.infer<typeof zModelFile>
export type NodeInput = z.infer<typeof zNodeInput>
export type NodeOutput = z.infer<typeof zNodeOutput>
export type ComfyLink = z.infer<typeof zComfyLink>
export type ComfyLinkObject = z.infer<typeof zComfyLinkObject>
export type ComfyNode = z.infer<typeof zComfyNode>
export type Reroute = z.infer<typeof zReroute>
export type WorkflowJSON04 = z.infer<typeof zComfyWorkflow>
export type WorkflowJSON10 = z.infer<typeof zComfyWorkflow1>
export type ComfyWorkflowJSON = z.infer<
  typeof zComfyWorkflow | typeof zComfyWorkflow1
>

const zWorkflowVersion = z.object({
  version: z.number()
})

export async function validateComfyWorkflow(
  data: unknown,
  onError: (error: string) => void = console.warn
): Promise<ComfyWorkflowJSON | null> {
  const versionResult = zWorkflowVersion.safeParse(data)

  let result: SafeParseReturnType<unknown, ComfyWorkflowJSON>
  if (!versionResult.success) {
    // Invalid workflow
    const error = fromZodError(versionResult.error)
    onError(`Workflow does not contain a valid version.  Zod error:\n${error}`)
    return null
  } else if (versionResult.data.version === 1) {
    // Schema version 1
    result = await zComfyWorkflow1.safeParseAsync(data)
  } else {
    // Unknown or old version: 0.4
    result = await zComfyWorkflow.safeParseAsync(data)
  }
  if (result.success) return result.data

  const error = fromZodError(result.error)
  onError(`Invalid workflow against zod schema:\n${error}`)
  return null
}

/**
 * API format workflow for direct API usage.
 */
const zNodeInputValue = z.union([
  // For widget values (can be any type)
  z.any(),
  // For node links [nodeId, slotIndex]
  z.tuple([zNodeId, zSlotIndex])
])

const zNodeData = z.object({
  inputs: z.record(zNodeInputName, zNodeInputValue),
  class_type: z.string(),
  _meta: z.object({
    title: z.string()
  })
})

export const zComfyApiWorkflow = z.record(zNodeId, zNodeData)
export type ComfyApiWorkflow = z.infer<typeof zComfyApiWorkflow>
