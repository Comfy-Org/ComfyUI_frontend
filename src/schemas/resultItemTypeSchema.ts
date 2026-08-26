import { z } from 'zod'

export const resultItemType = z.enum(['input', 'output', 'temp'])
export type ResultItemType = z.infer<typeof resultItemType>
