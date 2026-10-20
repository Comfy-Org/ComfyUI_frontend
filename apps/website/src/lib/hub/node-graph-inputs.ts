import { z } from 'zod'

export type NodeGraphInputMedia = 'image' | 'video' | 'audio'

/** A file the reader brings: its media type and the author's label, if any. */
export interface NodeGraphInput {
  readonly media: NodeGraphInputMedia
  readonly title?: string
}

const LOADER_MEDIA: Readonly<Record<string, NodeGraphInputMedia>> = {
  LoadImage: 'image',
  LoadImageMask: 'image',
  LoadVideo: 'video',
  LoadAudio: 'audio'
}

const graphNodeSchema = z.object({
  type: z.string().catch(''),
  title: z.string().optional().catch(undefined)
})
const graphSchema = z.object({
  nodes: z.array(graphNodeSchema).catch([]),
  definitions: z
    .object({
      subgraphs: z
        .array(z.object({ nodes: z.array(graphNodeSchema).catch([]) }))
        .catch([])
    })
    .optional()
    .catch(undefined)
})

const isTitleCaseWord = (word: string) => /^[A-Z][a-z]+$/.test(word)

function labelFromTitle(title: string | undefined): string | undefined {
  const words = (title ?? '')
    .replace(/^load\s+/i, '')
    .trim()
    .split(/\s+/)
  if (!words[0]) return undefined
  const [first, ...rest] = words
  return [
    first,
    ...rest.map((word) => (isTitleCaseWord(word) ? word.toLowerCase() : word))
  ].join(' ')
}

/** The loader nodes of a workflow graph, top level and subgraphs, as inputs. */
export function nodeGraphInputs(graph: unknown): NodeGraphInput[] {
  const parsed = graphSchema.safeParse(graph)
  if (!parsed.success) return []
  const { nodes, definitions } = parsed.data
  return [...nodes, ...(definitions?.subgraphs ?? []).flatMap((s) => s.nodes)]
    .filter((node) => node.type in LOADER_MEDIA)
    .map((node) => ({
      media: LOADER_MEDIA[node.type],
      title: labelFromTitle(node.title)
    }))
}
