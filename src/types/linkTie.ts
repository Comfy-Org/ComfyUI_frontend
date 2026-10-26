import { z } from 'zod'

import type { LinkId } from '@/types/linkId'

export type LinkTieId = number & { readonly __brand: 'LinkTieId' }

export function toLinkTieId(value: number): LinkTieId {
  return value as LinkTieId
}

/** A tie that holds links side by side, in graph space; `linkIds` is the strand order. */
export interface LinkTie {
  readonly id: LinkTieId
  readonly pos: readonly [x: number, y: number]
  readonly angle: number
  readonly linkIds: readonly LinkId[]
}

export type LinkTieDraft = Omit<LinkTie, 'id'>

/** Wire form of a {@link LinkTie}, as stored in `extra.linkTies`. */
export interface SerialisableLinkTie {
  id: number
  pos: [x: number, y: number]
  angle: number
  linkIds: number[]
}

const zSerialisableLinkTie = z.object({
  id: z.number(),
  pos: z.tuple([z.number(), z.number()]),
  angle: z.number(),
  linkIds: z.array(z.number())
})

/** The well-formed ties in an untrusted `extra.linkTies` value; anything else reads as no ties. */
export function parseLinkTies(value: unknown): SerialisableLinkTie[] {
  const ties = z.array(z.unknown()).safeParse(value)
  if (!ties.success) return []
  return ties.data.flatMap((tie) => {
    const parsed = zSerialisableLinkTie.safeParse(tie)
    return parsed.success ? [parsed.data] : []
  })
}

export function serialiseLinkTie(tie: LinkTie): SerialisableLinkTie {
  return {
    id: tie.id,
    pos: [tie.pos[0], tie.pos[1]],
    angle: tie.angle,
    linkIds: [...tie.linkIds]
  }
}
