import { sumBy } from 'es-toolkit'

import type {
  MissingModelCandidate,
  MissingModelGroup,
  MissingModelViewModel
} from '@/platform/missingModel/types'

const UNSUPPORTED = Symbol('unsupported')

export function countMissingModels(groups: MissingModelGroup[]): number {
  return sumBy(groups, (group) => group.models.length)
}

export function groupMissingModelCandidates(
  candidates: MissingModelCandidate[] | null | undefined,
  isCloud: boolean
): MissingModelGroup[] {
  if (!candidates?.length) return []

  type GroupKey = string | null | typeof UNSUPPORTED
  const map = new Map<
    GroupKey,
    { candidates: MissingModelCandidate[]; isAssetSupported: boolean }
  >()

  for (const candidate of candidates) {
    const groupKey: GroupKey =
      candidate.isAssetSupported || !isCloud
        ? candidate.directory || null
        : UNSUPPORTED
    const existing = map.get(groupKey)
    if (existing) {
      existing.candidates.push(candidate)
    } else {
      map.set(groupKey, {
        candidates: [candidate],
        isAssetSupported: candidate.isAssetSupported
      })
    }
  }

  return Array.from(map.entries())
    .sort(([dirA], [dirB]) => {
      if (dirA === UNSUPPORTED) return 1
      if (dirB === UNSUPPORTED) return -1
      if (dirA === null) return 1
      if (dirB === null) return -1
      return dirA.localeCompare(dirB)
    })
    .map(([key, { candidates: groupCandidates, isAssetSupported }]) => ({
      directory: typeof key === 'string' ? key : null,
      models: groupCandidatesByName(groupCandidates),
      isAssetSupported
    }))
}

function groupCandidatesByName(
  candidates: MissingModelCandidate[]
): MissingModelViewModel[] {
  const map = new Map<string, MissingModelViewModel>()
  for (const c of candidates) {
    const existing = map.get(c.name)
    if (existing) {
      if (c.nodeId) {
        existing.referencingNodes.push({
          nodeId: c.nodeId,
          widgetName: c.widgetName
        })
      }
    } else {
      map.set(c.name, {
        name: c.name,
        representative: c,
        referencingNodes: c.nodeId
          ? [{ nodeId: c.nodeId, widgetName: c.widgetName }]
          : []
      })
    }
  }
  return Array.from(map.values())
}
