import type { MessageVariants } from '@/components/ui/message/message.variants'
import type { components } from '@/types/comfyRegistryTypes'

type PackVersionStatus = components['schemas']['NodeVersionStatus']
type PackStatus = components['schemas']['NodeStatus']

export type PackStatusType = PackVersionStatus | PackStatus
type PackStatusSeverity = MessageVariants['severity']

interface PackStatusPresentation {
  label: string
  severity: PackStatusSeverity
}

const STATUS_PRESENTATION: Record<PackStatusType, PackStatusPresentation> = {
  NodeStatusActive: { label: 'active', severity: 'success' },
  NodeStatusDeleted: { label: 'deleted', severity: 'warning' },
  NodeStatusBanned: { label: 'banned', severity: 'error' },
  NodeVersionStatusActive: { label: 'active', severity: 'success' },
  NodeVersionStatusPending: { label: 'pending', severity: 'warning' },
  NodeVersionStatusDeleted: { label: 'deleted', severity: 'warning' },
  NodeVersionStatusFlagged: { label: 'flagged', severity: 'warning' },
  NodeVersionStatusBanned: { label: 'banned', severity: 'error' }
}

// A security status is why the pack conflicts, so it outranks 'conflicting'.
const SECURITY_STATUSES = new Set<PackStatusType>([
  'NodeStatusBanned',
  'NodeVersionStatusBanned',
  'NodeVersionStatusFlagged'
])

function isSecurityStatus(statusType: PackStatusType): boolean {
  return SECURITY_STATUSES.has(statusType)
}

const UNKNOWN_PRESENTATION: PackStatusPresentation = {
  label: 'unknown',
  severity: 'secondary'
}

export function resolvePackStatusPresentation({
  statusType,
  hasCompatibilityIssues = false,
  importFailed = false
}: {
  statusType: PackStatusType
  hasCompatibilityIssues?: boolean
  importFailed?: boolean
}): PackStatusPresentation {
  if (importFailed) return { label: 'importFailed', severity: 'error' }

  // STATUS_PRESENTATION is exhaustive over the current enums, but the status
  // arrives from the registry, so a value added server-side reaches here first.
  const presentation =
    statusType in STATUS_PRESENTATION
      ? STATUS_PRESENTATION[statusType]
      : UNKNOWN_PRESENTATION

  if (isSecurityStatus(statusType)) return presentation

  if (hasCompatibilityIssues) return { label: 'conflicting', severity: 'error' }

  return presentation
}
