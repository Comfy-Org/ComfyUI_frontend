import { z } from 'zod'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { resultItemType } from '@/schemas/resultItemTypeSchema'
import { api } from '@/scripts/api'

const zSegmentPreview = z.object({
  filename: z.string(),
  subfolder: z.string().default(''),
  type: resultItemType,
  source: z.tuple([z.string(), z.number()]).nullish()
})

type SegmentPreview = z.infer<typeof zSegmentPreview>

export function parseSegmentPreviews(value: unknown): SegmentPreview[] {
  const parsed = z.array(zSegmentPreview).safeParse(value)
  return parsed.success ? parsed.data : []
}

export function segmentPreviewUrl(
  previews: readonly SegmentPreview[],
  source: { node: LGraphNode; slot?: number } | undefined
): string | undefined {
  if (!source) return undefined
  const preview = previews.find(
    ({ source: origin }) =>
      origin?.[0].split(':').at(-1) === String(source.node.id) &&
      (source.slot === undefined || origin[1] === source.slot)
  )
  if (!preview) return undefined
  const { filename, subfolder, type } = preview
  return api.apiURL(
    `/view?${new URLSearchParams({ filename, subfolder, type })}`
  )
}
