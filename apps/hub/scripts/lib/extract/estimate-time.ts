import type { WorkflowJson } from '../types'
import { HEAVY_NODE_TYPES, VIDEO_NODE_TYPES } from '../constants'

export function estimateGenerationTime(
  workflow: WorkflowJson,
  mediaType: string,
  templateName: string
): string | undefined {
  const nodes = workflow.nodes || []

  const nodeCount = nodes.length
  const heavyNodeCount = nodes.filter((n) =>
    HEAVY_NODE_TYPES.has(n.type)
  ).length
  const hasVideoNodes = nodes.some((n) => VIDEO_NODE_TYPES.has(n.type))

  let minTime = 5
  let maxTime = 15

  minTime += nodeCount * 0.5
  maxTime += nodeCount * 1.5

  minTime += heavyNodeCount * 3
  maxTime += heavyNodeCount * 8

  if (mediaType === 'video' || hasVideoNodes) {
    minTime *= 3
    maxTime *= 5
  }

  if (mediaType === '3d') {
    minTime *= 2
    maxTime *= 3
  }

  if (mediaType === 'audio') {
    minTime *= 0.8
    maxTime *= 0.8
  }

  if (templateName.startsWith('api_')) {
    minTime *= 0.5
    maxTime *= 0.7
  }

  minTime = Math.round(minTime)
  maxTime = Math.round(maxTime)

  if (maxTime < 60) {
    return `${minTime}-${maxTime} seconds`
  } else if (maxTime < 120) {
    const minMins = Math.max(1, Math.round(minTime / 60))
    const maxMins = Math.round(maxTime / 60)
    if (minMins === maxMins) {
      return `~${minMins} minute${minMins > 1 ? 's' : ''}`
    }
    return `${minMins}-${maxMins} minutes`
  } else {
    const minMins = Math.round(minTime / 60)
    const maxMins = Math.round(maxTime / 60)
    return `${minMins}-${maxMins} minutes`
  }
}
