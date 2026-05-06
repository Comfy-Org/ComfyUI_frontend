import type { PreviewExposure } from '@/core/schemas/previewExposureSchema'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'

/**
 * Host-scoped UI identity for a preview exposure.
 *
 * Identifies a single preview surfacing on a particular host SubgraphNode.
 * `previewName` matches `PreviewExposure.name` — a stable host-scoped identity
 * generated via `nextUniqueName` at creation time, not a display label.
 */
export interface PreviewExposureIdentity {
  hostNodeLocator: string
  previewName: string
}

/**
 * One step along a chain of preview exposures rooted at an outer host.
 *
 * `exposure` is the canonical entry on `(rootGraphId, hostNodeLocator)` that
 * the walk traversed at this step.
 */
export interface ResolvedPreviewChainStep {
  rootGraphId: UUID
  hostNodeLocator: string
  exposure: PreviewExposure
}

/**
 * The result of walking a preview-exposure chain through zero or more nested
 * subgraph hosts.
 *
 * @remarks
 * `steps` is ordered outer-most first. A single-link chain has exactly one
 * step. `leaf` describes the final non-host source — the interior node id and
 * preview name reached at the bottom of the walk.
 */
export interface ResolvedPreviewChain {
  steps: readonly ResolvedPreviewChainStep[]
  leaf: {
    rootGraphId: UUID
    sourceNodeId: string
    sourcePreviewName: string
  }
}

export type { PreviewExposure }
