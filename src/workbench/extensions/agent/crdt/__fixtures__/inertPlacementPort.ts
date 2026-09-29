import type { SemanticPlacementPort } from '../graphMutations'

/** A placement port that never repositions: no known geometry, no viewport. */
export const inertPlacementPort: SemanticPlacementPort = {
  nodeBounds: () => null,
  viewportBounds: () => null
}
