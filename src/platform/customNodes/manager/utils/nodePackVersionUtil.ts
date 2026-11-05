import { maxSatisfying } from 'semver'

import type { components } from '@/types/comfyRegistryTypes'

type NodeVersion = components['schemas']['NodeVersion']
type NodeVersionStatus = components['schemas']['NodeVersionStatus']

export const versionStatusFilters: Record<
  'active' | 'installable',
  NodeVersionStatus[]
> = {
  active: ['NodeVersionStatusActive'],
  installable: [
    'NodeVersionStatusActive',
    'NodeVersionStatusFlagged',
    'NodeVersionStatusPending'
  ]
}

export function getLatestVersion(
  versions: NodeVersion[],
  statuses: NodeVersionStatus[]
) {
  const candidates = versions.filter(
    (version) => version.status && statuses.includes(version.status)
  )
  const latest = maxSatisfying(
    candidates.map((version) => version.version ?? ''),
    '*',
    { includePrerelease: true }
  )
  return candidates.find((version) => version.version === latest)
}
