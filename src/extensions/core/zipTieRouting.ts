import { z } from 'zod'

import type { LGraph, LLink } from '@/lib/litegraph/src/litegraph'
import type { Reroute } from '@/lib/litegraph/src/Reroute'
import type { PointTuple as Point } from '@comfyorg/shared-frontend-utils/geometry'
import { toRerouteId } from '@comfyorg/graph-model/rerouteId'

const zipTieSchema = z.object({
  rerouteIds: z.array(z.number().int().nonnegative()).min(2)
})
const zipTiesSchema = z.array(zipTieSchema)

export type ZipTie = z.infer<typeof zipTieSchema>

export function getZipTies(graph: LGraph): ZipTie[] {
  const parsed = zipTiesSchema.safeParse(graph.extra.zipTies)
  return parsed.success ? parsed.data : []
}

export function resolveZipTie(graph: LGraph, tie: ZipTie): Reroute[] {
  return tie.rerouteIds.flatMap((id) => {
    const reroute = graph.reroutes.get(toRerouteId(id))
    return reroute?.totalLinks ? [reroute] : []
  })
}

export function zipTieBounds(reroutes: readonly Reroute[]) {
  const xs = reroutes.map((reroute) => reroute.pos[0])
  const ys = reroutes.map((reroute) => reroute.pos[1])
  const x = (Math.min(...xs) + Math.max(...xs)) / 2
  const top = Math.min(...ys) - 10
  return { x: x - 8, y: top, width: 16, height: Math.max(...ys) + 10 - top }
}

export function createZipTie(
  graph: LGraph,
  links: readonly LLink[],
  [x, y]: Point
): ZipTie | undefined {
  const owned = [...new Set(links)].filter(
    (link) => graph.getLink(link.id) === link
  )
  if (owned.length < 2) return
  const reroutes: Reroute[] = []
  for (const [index, link] of owned.entries()) {
    const laneY = y + (index - (owned.length - 1) / 2) * 6
    const entry = graph.createReroute([x - 36, laneY], link)
    const exit = graph.createReroute([x + 36, laneY], link)
    if (!entry || !exit) {
      if (entry) reroutes.push(entry)
      if (exit) reroutes.push(exit)
      for (const reroute of reroutes) graph.removeReroute(reroute.id)
      return
    }
    reroutes.push(entry, exit)
  }
  const tie = { rerouteIds: reroutes.map((reroute) => reroute.id) }
  graph.extra.zipTies = [...getZipTies(graph), tie]
  return tie
}

export function releaseZipTie(graph: LGraph, tie: ZipTie): void {
  graph.extra.zipTies = getZipTies(graph).filter(
    (candidate) => candidate.rerouteIds[0] !== tie.rerouteIds[0]
  )
  for (const id of tie.rerouteIds) graph.removeReroute(toRerouteId(id))
}
