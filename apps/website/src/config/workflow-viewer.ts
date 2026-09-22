import { z } from 'zod'

const id = z.union([z.number(), z.string()])
const point = z.tuple([z.number(), z.number()])
const slot = z.object({
  name: z.string(),
  type: z.union([z.string(), z.number(), z.array(z.string())]),
  widget: z.object({ name: z.string() }).optional()
})
const node = z.object({
  id,
  type: z.string(),
  title: z.string().optional(),
  pos: point,
  size: point,
  color: z.string().optional(),
  bgcolor: z.string().optional(),
  inputs: z.array(slot).default([]),
  outputs: z.array(slot).default([]),
  widgets_values: z
    .union([z.array(z.unknown()), z.record(z.string(), z.unknown())])
    .optional()
})
const link = z.object({
  id: z.number(),
  origin_id: id,
  origin_slot: z.number(),
  target_id: id,
  target_slot: z.number(),
  type: z.unknown().optional()
})
const boundary = z.object({
  id,
  bounding: z.tuple([z.number(), z.number(), z.number(), z.number()])
})
const graph = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  nodes: z.array(node),
  links: z
    .array(
      z.union([
        link,
        z
          .tuple([z.number(), id, z.number(), id, z.number(), z.unknown()])
          .transform(
            ([id, origin_id, origin_slot, target_id, target_slot, type]) => ({
              id,
              origin_id,
              origin_slot,
              target_id,
              target_slot,
              type
            })
          )
      ])
    )
    .default([]),
  groups: z
    .array(
      z.object({
        title: z.string(),
        bounding: z.tuple([z.number(), z.number(), z.number(), z.number()]),
        color: z.string().optional()
      })
    )
    .default([]),
  inputNode: boundary.optional(),
  outputNode: boundary.optional(),
  inputs: z.array(slot).default([]),
  outputs: z.array(slot).default([])
})

export const workflowViewerSchema = graph.extend({
  definitions: z.object({ subgraphs: z.array(graph).default([]) }).optional()
})
export type ViewerGraph = z.infer<typeof graph>
export type ViewerWorkflow = z.infer<typeof workflowViewerSchema>

export function nodeValues(node: ViewerGraph['nodes'][number]): string[] {
  return Object.values(node.widgets_values ?? {}).map((value) =>
    typeof value === 'string' ? value : JSON.stringify(value)
  )
}
