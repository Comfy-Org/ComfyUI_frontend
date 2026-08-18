import { z } from 'zod'

/** Hash values from the URL bar are untrusted; validate before lookup. */
export const zSubgraphId = z.string().uuid()

type SubgraphId = z.infer<typeof zSubgraphId>

export function isUuidShapedSubgraphId(value: unknown): value is SubgraphId {
  return zSubgraphId.safeParse(value).success
}
