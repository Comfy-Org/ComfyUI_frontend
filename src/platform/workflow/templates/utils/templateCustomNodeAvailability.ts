import type { components } from '@/types/comfyRegistryTypes'

type NodePack = components['schemas']['Node']

export type TemplateCustomNodeManagerCapability =
  | 'ready'
  | 'disabled'
  | 'legacy'
  | 'incompatible'

type TemplateCustomNodeUnavailableReason =
  | 'manager-disabled'
  | 'manager-legacy'
  | 'manager-incompatible'
  | 'not-in-registry'
  | 'unsafe'
  | 'incompatible'
  | 'invalid-payload'

export type TemplateCustomNodeEligibility =
  | { status: 'eligible'; pack: NodePack }
  | {
      status: 'unavailable'
      reason: Extract<
        TemplateCustomNodeUnavailableReason,
        'unsafe' | 'incompatible' | 'invalid-payload'
      >
    }
  | { status: 'unknown' }

export type TemplateCustomNodeAvailabilitySnapshot = {
  managerCapability: TemplateCustomNodeManagerCapability
  installedInventory: {
    isComplete: boolean
    entries: readonly { id: string; enabled: boolean }[]
  }
  inProgressIds: readonly string[]
  registry: {
    isComplete: boolean
    eligibilityById: Readonly<Record<string, TemplateCustomNodeEligibility>>
  }
}

export type ResolvedTemplateCustomNodeAvailability =
  | {
      id: string
      status: 'installed' | 'disabled' | 'in-progress' | 'unknown'
    }
  | {
      id: string
      status: 'unavailable'
      reason: TemplateCustomNodeUnavailableReason
    }
  | { id: string; status: 'missing'; pack: NodePack }

export function resolveTemplateCustomNodeAvailability(
  ids: readonly string[],
  snapshot: TemplateCustomNodeAvailabilitySnapshot
): ResolvedTemplateCustomNodeAvailability[] {
  const inProgressIds = new Set(snapshot.inProgressIds)
  const enabledIds = new Set(
    snapshot.installedInventory.entries
      .filter((entry) => entry.enabled)
      .map((entry) => entry.id)
  )
  const disabledIds = new Set(
    snapshot.installedInventory.entries
      .filter((entry) => !entry.enabled)
      .map((entry) => entry.id)
  )

  return ids.map((id): ResolvedTemplateCustomNodeAvailability => {
    if (inProgressIds.has(id)) return { id, status: 'in-progress' }
    if (enabledIds.has(id)) return { id, status: 'installed' }
    if (disabledIds.has(id)) return { id, status: 'disabled' }
    if (!snapshot.installedInventory.isComplete) {
      return { id, status: 'unknown' }
    }
    if (snapshot.managerCapability !== 'ready') {
      return {
        id,
        status: 'unavailable',
        reason: `manager-${snapshot.managerCapability}`
      }
    }
    if (!snapshot.registry.isComplete) return { id, status: 'unknown' }

    const eligibility = snapshot.registry.eligibilityById[id]
    if (!eligibility) {
      return { id, status: 'unavailable', reason: 'not-in-registry' }
    }
    if (eligibility.status === 'unknown') return { id, status: 'unknown' }
    if (eligibility.status === 'unavailable') {
      return { id, status: 'unavailable', reason: eligibility.reason }
    }
    return { id, status: 'missing', pack: eligibility.pack }
  })
}

export function applyTemplateCustomNodeLiveState(
  availability: ResolvedTemplateCustomNodeAvailability,
  state: {
    isInstalling: boolean
    isInstalled: boolean
    isEnabled: boolean
  }
): ResolvedTemplateCustomNodeAvailability {
  if (state.isInstalling) {
    return { id: availability.id, status: 'in-progress' }
  }
  if (state.isInstalled) {
    return {
      id: availability.id,
      status: state.isEnabled ? 'installed' : 'disabled'
    }
  }
  return availability
}
