import { z } from 'zod'

import { FILE_INPUTS } from './workflow-detail'

export type NodeGraphInputMedia = 'image' | 'video' | 'audio'

/** A file the reader brings: its media type and the author's label, if any. */
export interface NodeGraphInput {
  readonly media: NodeGraphInputMedia
  readonly title?: string
}

const MUTED = 2
const BYPASSED = 4

function loaderMedia(type: string): NodeGraphInputMedia | undefined {
  return Object.hasOwn(FILE_INPUTS, type)
    ? FILE_INPUTS[type]?.accept
    : undefined
}

const graphNodeSchema = z.object({
  type: z.string(),
  title: z.string().optional().catch(undefined),
  mode: z.number().optional().catch(undefined)
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

function activeNodes(
  nodes: readonly GraphNode[],
  subgraphs: ReadonlyMap<string, readonly GraphNode[]>,
  entered: ReadonlySet<string> = new Set()
): GraphNode[] {
  return nodes.filter(isActive).flatMap((node) => {
    const inner = subgraphs.get(node.type)
    if (!inner || entered.has(node.type)) return [node]
    return activeNodes(inner, subgraphs, new Set([...entered, node.type]))
  })
}

/** The active loader nodes of a workflow graph, including used subgraphs. */
export function nodeGraphInputs(graph: unknown): NodeGraphInput[] {
  const parsed = graphSchema.safeParse(graph)
  if (!parsed.success) return []
  const { nodes, definitions } = parsed.data
  const subgraphs = new Map(
    (definitions?.subgraphs ?? []).map((subgraph) => [
      subgraph.id,
      subgraph.nodes
    ])
  )
  return activeNodes(nodes, subgraphs).flatMap((node) => {
    const media = loaderMedia(node.type)
    return media ? [{ media, title: labelFromTitle(node.title) }] : []
  })
}
