import type { PreviewExposure } from '@/core/schemas/previewExposureSchema'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'

import type {
  ResolvedPreviewChain,
  ResolvedPreviewChainStep
} from './previewExposureTypes'

/**
 * Lookup callbacks the chain walker needs to follow nested-host boundaries.
 *
 * The walker is graph-agnostic: it does not import LGraph. The store layer or
 * test harness wires up these callbacks against a real graph or a fixture.
 */
export interface PreviewExposureChainContext {
  /**
   * Return the canonical preview exposures registered on
   * `(rootGraphId, hostNodeLocator)`.
   */
  getExposures(
    rootGraphId: UUID,
    hostNodeLocator: string
  ): readonly PreviewExposure[]
  /**
   * If `sourceNodeId` (interpreted on the host's interior subgraph) is itself
   * a SubgraphNode, return the inner host's `(rootGraphId, hostNodeLocator)`
   * so the walk can recurse. Return `undefined` for leaf (non-host) sources.
   */
  resolveNestedHost(
    rootGraphId: UUID,
    hostNodeLocator: string,
    sourceNodeId: string
  ): { rootGraphId: UUID; hostNodeLocator: string } | undefined
}

const MAX_CHAIN_DEPTH = 32

function visitedKey(
  rootGraphId: UUID,
  hostNodeLocator: string,
  name: string
): string {
  return `${rootGraphId}|${hostNodeLocator}|${name}`
}

/**
 * Walk a preview-exposure chain from an outer host through any nested-host
 * boundaries down to a leaf source.
 *
 * @returns The {@link ResolvedPreviewChain} or `undefined` when the named
 * exposure does not exist on the starting host.
 *
 * @remarks
 * Cycles are detected via a visited set; a cycle terminates the walk at the
 * cycle entry and emits a `console.warn`. The walk also terminates at a fixed
 * `MAX_CHAIN_DEPTH` to defend against pathological inputs.
 */
export function resolvePreviewExposureChain(
  rootGraphId: UUID,
  hostNodeLocator: string,
  name: string,
  ctx: PreviewExposureChainContext
): ResolvedPreviewChain | undefined {
  const steps: ResolvedPreviewChainStep[] = []
  const visited = new Set<string>()

  let currentRootGraphId: UUID = rootGraphId
  let currentHost = hostNodeLocator
  let currentName = name

  for (let depth = 0; depth < MAX_CHAIN_DEPTH; depth++) {
    const key = visitedKey(currentRootGraphId, currentHost, currentName)
    if (visited.has(key)) {
      console.warn(
        `[previewExposureChain] cycle detected at ${key}; terminating walk`
      )
      break
    }
    visited.add(key)

    const exposures = ctx.getExposures(currentRootGraphId, currentHost)
    const exposure = exposures.find((e) => e.name === currentName)
    if (!exposure) {
      if (steps.length === 0) return undefined
      // Source on outer host pointed at a non-existent inner exposure; treat
      // the outer step as the leaf and stop walking.
      const last = steps[steps.length - 1].exposure
      return {
        steps,
        leaf: {
          rootGraphId: currentRootGraphId,
          sourceNodeId: last.sourceNodeId,
          sourcePreviewName: last.sourcePreviewName
        }
      }
    }

    steps.push({
      rootGraphId: currentRootGraphId,
      hostNodeLocator: currentHost,
      exposure
    })

    const nested = ctx.resolveNestedHost(
      currentRootGraphId,
      currentHost,
      exposure.sourceNodeId
    )
    if (!nested) {
      return {
        steps,
        leaf: {
          rootGraphId: currentRootGraphId,
          sourceNodeId: exposure.sourceNodeId,
          sourcePreviewName: exposure.sourcePreviewName
        }
      }
    }

    currentRootGraphId = nested.rootGraphId
    currentHost = nested.hostNodeLocator
    currentName = exposure.sourcePreviewName
  }

  console.warn(
    `[previewExposureChain] max chain depth (${MAX_CHAIN_DEPTH}) reached; terminating walk`
  )
  if (steps.length === 0) return undefined
  const last = steps[steps.length - 1].exposure
  return {
    steps,
    leaf: {
      rootGraphId: currentRootGraphId,
      sourceNodeId: last.sourceNodeId,
      sourcePreviewName: last.sourcePreviewName
    }
  }
}
