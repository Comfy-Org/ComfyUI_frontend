import { z } from 'zod'

import { nodePackName } from './node-pack-names'
import { FILE_INPUTS } from './file-inputs'

export type NodeGraphInputMedia = 'image' | 'video' | 'audio'

/** A file the reader brings: its media type and the author's label, if any. */
export interface NodeGraphInput {
  readonly media: NodeGraphInputMedia
  readonly title?: string
}

const MUTED = 2
const BYPASSED = 4

const MASK_LOADERS: Readonly<Record<string, NodeGraphInputMedia>> = {
  LoadImageMask: 'image'
}

function loaderMedia(type: string): NodeGraphInputMedia | undefined {
  if (Object.hasOwn(FILE_INPUTS, type)) return FILE_INPUTS[type]?.accept
  return Object.hasOwn(MASK_LOADERS, type) ? MASK_LOADERS[type] : undefined
}

const graphNodeSchema = z.object({
  type: z.string(),
  title: z.string().optional().catch(undefined),
  mode: z.number().optional().catch(undefined),
  properties: z
    .object({
      cnr_id: z.string().optional().catch(undefined),
      aux_id: z.string().optional().catch(undefined)
    })
    .optional()
    .catch(undefined)
})
type GraphNode = z.output<typeof graphNodeSchema>

const nodeListSchema = z
  .array(z.unknown())
  .catch([])
  .transform((nodes) =>
    nodes.flatMap((node): GraphNode[] => {
      const parsed = graphNodeSchema.safeParse(node)
      return parsed.success ? [parsed.data] : []
    })
  )

const subgraphSchema = z.object({ id: z.string(), nodes: nodeListSchema })

const graphSchema = z.object({
  nodes: nodeListSchema,
  definitions: z
    .object({
      subgraphs: z
        .array(z.unknown())
        .catch([])
        .transform((subgraphs) =>
          subgraphs.flatMap((subgraph) => {
            const parsed = subgraphSchema.safeParse(subgraph)
            return parsed.success ? [parsed.data] : []
          })
        )
    })
    .optional()
    .catch(undefined)
})

const DEFAULT_TITLE = /^load( (image|video|audio)( mask)?)?$/i
const TRAILING_MEDIA_WORD = /\s(Image|Video|Audio)$/

function labelFromTitle(title: string | undefined): string | undefined {
  const trimmed = (title ?? '').trim()
  if (!trimmed || DEFAULT_TITLE.test(trimmed)) return undefined
  const label = trimmed
    .replace(/^load\s+/i, '')
    .replace(TRAILING_MEDIA_WORD, (word) => word.toLowerCase())
  return label.charAt(0).toUpperCase() + label.slice(1)
}

const isActive = (node: GraphNode) =>
  node.mode !== MUTED && node.mode !== BYPASSED

const MAX_NODES = 5000

function activeNodes(
  nodes: readonly GraphNode[],
  subgraphs: ReadonlyMap<string, readonly GraphNode[]>
): GraphNode[] {
  const leaves = new Map<string, readonly GraphNode[]>()
  const expanding = new Set<string>()

  function leavesOf(id: string, inner: readonly GraphNode[]) {
    const known = leaves.get(id)
    if (known) return known
    if (expanding.has(id)) return []
    expanding.add(id)
    const found = expand(inner)
    expanding.delete(id)
    leaves.set(id, found)
    return found
  }

  function expand(list: readonly GraphNode[]): GraphNode[] {
    const found: GraphNode[] = []
    for (const node of list) {
      if (found.length >= MAX_NODES) break
      if (!isActive(node)) continue
      const inner = subgraphs.get(node.type)
      const instance = inner ? leavesOf(node.type, inner) : [node]
      found.push(...instance.slice(0, MAX_NODES - found.length))
    }
    return found
  }

  return expand(nodes)
}

function activeGraphNodes(graph: unknown): GraphNode[] {
  const parsed = graphSchema.safeParse(graph)
  if (!parsed.success) return []
  const { nodes, definitions } = parsed.data
  const subgraphs = new Map(
    (definitions?.subgraphs ?? []).map((subgraph) => [
      subgraph.id,
      subgraph.nodes
    ])
  )
  return activeNodes(nodes, subgraphs)
}

/** The active loader nodes of a workflow graph, once per subgraph instance. */
export function nodeGraphInputs(graph: unknown): NodeGraphInput[] {
  return activeGraphNodes(graph).flatMap((node) => {
    const media = loaderMedia(node.type)
    return media ? [{ media, title: labelFromTitle(node.title) }] : []
  })
}

const CORE_PACK = 'comfy-core'

function customPackOf(
  node: GraphNode
): { key: string; name: string } | undefined {
  const { cnr_id: registryId, aux_id: repo } = node.properties ?? {}
  if (registryId === CORE_PACK) return undefined
  const repoName = repo?.split('/').pop() || undefined
  const id = registryId || repoName
  if (!id) return undefined
  return { key: id.toLowerCase(), name: nodePackName(id, repoName) }
}

/** The custom node packs the active nodes of a workflow graph come from. */
export function nodeGraphCustomNodes(graph: unknown): string[] {
  const packs = new Map<string, string>()
  for (const pack of activeGraphNodes(graph).map(customPackOf))
    if (pack && !packs.has(pack.key)) packs.set(pack.key, pack.name)
  return [...packs.values()]
}
