import { sumBy } from 'es-toolkit'

import type {
  MissingModelCandidate,
  MissingModelGroup
} from '@/platform/missingModel/types'
import { groupCandidatesByName } from '@/platform/missingModel/missingModelScan'

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
