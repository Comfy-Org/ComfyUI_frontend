import { z } from 'zod'

export const sizeMetricsSchema = z.object({
  size: z.number(),
  gzip: z.number(),
  brotli: z.number()
})

export const bundleSizeSchema = sizeMetricsSchema.extend({
  file: z.string(),
  category: z.string().optional()
})

export type SizeMetrics = z.infer<typeof sizeMetricsSchema>
export type BundleSize = z.infer<typeof bundleSizeSchema>
