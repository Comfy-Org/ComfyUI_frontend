import type { PreviewExposure } from '@/core/schemas/previewExposureSchema'
import type { NodeId } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'

type ChainPreviewExposure = Omit<PreviewExposure, 'sourceNodeId'> & {
  sourceNodeId: NodeId
}

interface ResolvedPreviewChainStep {
  rootGraphId: UUID
  hostNodeLocator: string
  exposure: ChainPreviewExposure
}

export interface ResolvedPreviewChain {
  steps: readonly ResolvedPreviewChainStep[]
  leaf: {
    rootGraphId: UUID
    sourceNodeId: NodeId
    sourcePreviewName: string
  }
}

export interface PreviewExposureChainContext {
  getExposures(
    rootGraphId: UUID,
    hostNodeLocator: string
  ): readonly ChainPreviewExposure[]
  resolveNestedHost(
    rootGraphId: UUID,
    hostNodeLocator: string,
    sourceNodeId: NodeId
  ): { rootGraphId: UUID; hostNodeLocator: string } | undefined
}

const MAX_CHAIN_DEPTH = 32

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

  const chainFromLastStep = (): ResolvedPreviewChain | undefined => {
    if (steps.length === 0) return undefined
    const lastStep = steps[steps.length - 1]
    return {
      steps,
      leaf: {
        rootGraphId: lastStep.rootGraphId,
        sourceNodeId: lastStep.exposure.sourceNodeId,
        sourcePreviewName: lastStep.exposure.sourcePreviewName
      }
    }
  }

  for (let depth = 0; depth < MAX_CHAIN_DEPTH; depth++) {
    const key = `${currentRootGraphId}|${currentHost}|${currentName}`
    if (visited.has(key)) {
      console.warn(
        `[previewExposureChain] cycle detected at ${key}; terminating walk`
      )
      return chainFromLastStep()
    }
    visited.add(key)

    const exposure = ctx
      .getExposures(currentRootGraphId, currentHost)
      .find((e) => e.name === currentName)
    if (!exposure) return chainFromLastStep()

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
  return chainFromLastStep()
}
