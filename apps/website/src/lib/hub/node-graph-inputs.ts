import { z } from 'zod'

export type NodeGraphInputMedia = 'image' | 'video' | 'audio'

/** A file the reader brings: its media type and the author's label, if any. */
export interface NodeGraphInput {
  readonly media: NodeGraphInputMedia
  readonly title?: string
}

const LOADER_MEDIA: ReadonlyMap<string, NodeGraphInputMedia> = new Map([
  ['LoadImage', 'image'],
  ['LoadImageMask', 'image'],
  ['LoadVideo', 'video'],
  ['LoadAudio', 'audio']
])

const graphNodeSchema = z.object({
  type: z.string(),
  title: z.string().optional().catch(undefined)
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

const graphSchema = z.object({
  nodes: nodeListSchema,
  definitions: z
    .object({
      subgraphs: z.array(z.object({ nodes: nodeListSchema })).catch([])
    })
    .optional()
    .catch(undefined)
})

const DEFAULT_TITLE = /^load( (image|video|audio)( mask)?)?$/i
const TRAILING_MEDIA_WORD = /\s(Image|Video|Audio)$/

function labelFromTitle(title: string | undefined): string | undefined {
  const trimmed = (title ?? '').trim()
  if (!trimmed || DEFAULT_TITLE.test(trimmed)) return undefined
  const label = trimmed.replace(/^load\s+/i, '')
  return label.replace(TRAILING_MEDIA_WORD, (word) => word.toLowerCase())
}

/** The loader nodes of a workflow graph, top level and subgraphs, as inputs. */
export function nodeGraphInputs(graph: unknown): NodeGraphInput[] {
  const parsed = graphSchema.safeParse(graph)
  if (!parsed.success) return []
  const { nodes, definitions } = parsed.data
  return [
    ...nodes,
    ...(definitions?.subgraphs ?? []).flatMap((s) => s.nodes)
  ].flatMap((node) => {
    const media = LOADER_MEDIA.get(node.type)
    return media ? [{ media, title: labelFromTitle(node.title) }] : []
  })
}
