import type { LinkId } from '@comfyorg/graph-model/linkId'
import type { RerouteId } from '@comfyorg/graph-model/rerouteId'

/**
 * Creates a unique key for identifying link segments in spatial indexes
 */
export function makeLinkSegmentKey(
  linkId: LinkId,
  rerouteId: RerouteId | null
): string {
  return `${linkId}:${rerouteId ?? 'final'}`
}
