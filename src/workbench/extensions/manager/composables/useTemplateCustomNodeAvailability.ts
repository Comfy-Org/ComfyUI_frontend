import type { operations, components } from '@/types/comfyRegistryTypes'
import type {
  TemplateCustomNodeEligibility,
  ResolvedTemplateCustomNodeAvailability,
  TemplateCustomNodeManagerCapability
} from '@/platform/workflow/templates/utils/templateCustomNodeAvailability'
import { resolveTemplateCustomNodeAvailability } from '@/platform/workflow/templates/utils/templateCustomNodeAvailability'
import { useComfyRegistryService } from '@/services/comfyRegistryService'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import type { components as ManagerComponents } from '@/workbench/extensions/manager/types/generatedManagerTypes'
import type { RegistryAccelerator } from '@/workbench/extensions/manager/types/compatibility.types'
import type { SystemEnvironment } from '@/workbench/extensions/manager/types/conflictDetectionTypes'
import {
  deriveStatusFlags,
  evaluateCompatibility
} from '@/workbench/extensions/manager/utils/conflictUtils'
import { normalizeOSList } from '@/workbench/extensions/manager/utils/systemCompatibility'
import { getFrontendVersion } from '@/workbench/extensions/manager/utils/versionUtil'

import { ManagerUIState, useManagerState } from './useManagerState'
import { useComfyManagerService } from '../services/comfyManagerService'
import { useComfyManagerStore } from '../stores/comfyManagerStore'

type NodePack = components['schemas']['Node']
type RegistryListResponse =
  operations['listAllNodes']['responses'][200]['content']['application/json']
type InstalledPacksResponse =
  ManagerComponents['schemas']['InstalledPacksResponse']

export type TemplateCustomNodeAvailabilityDependencies = {
  getManagerCapability: () => TemplateCustomNodeManagerCapability
  listInstalledPacks: (
    signal?: AbortSignal
  ) => Promise<InstalledPacksResponse | null>
  isPackInstalling: (id: string) => boolean
  listRegistryPacks: (
    ids: readonly string[],
    signal?: AbortSignal
  ) => Promise<RegistryListResponse | null>
  getEnvironment: () => SystemEnvironment
}

function normalizeAccelerators(
  values?: string[]
): RegistryAccelerator[] | undefined {
  if (!values?.length) return undefined
  const normalized: RegistryAccelerator[] = []
  for (const value of values) {
    if (!isRegistryAccelerator(value) || normalized.includes(value)) continue
    normalized.push(value)
  }
  return normalized.length ? normalized : undefined
}

function isRegistryAccelerator(value: string): value is RegistryAccelerator {
  return (
    value === 'CUDA' || value === 'ROCm' || value === 'Metal' || value === 'CPU'
  )
}

function hasUnknownEnvironmentRequirement(
  pack: NodePack,
  environment: SystemEnvironment
): boolean {
  const sources = [pack, pack.latest_version].filter(
    (source): source is NodePack | NonNullable<NodePack['latest_version']> =>
      source !== undefined
  )

  return sources.some((source) => {
    if (source.supported_os?.length && !environment.os) return true
    if (source.supported_accelerators?.length && !environment.accelerator) {
      return true
    }
    if (source.supported_comfyui_version && !environment.comfyui_version) {
      return true
    }
    return (
      !!source.supported_comfyui_frontend_version &&
      !environment.frontend_version
    )
  })
}

function hasUnrecognizedCompatibilityValue(pack: NodePack): boolean {
  const sources = [pack, pack.latest_version].filter(
    (source): source is NodePack | NonNullable<NodePack['latest_version']> =>
      source !== undefined
  )

  return sources.some((source) => {
    const os = source.supported_os
    const osUnknown =
      !!os?.length &&
      !os.some((value) => value.toLowerCase() === 'os independent') &&
      !normalizeOSList(os)?.length
    const accelerators = source.supported_accelerators
    const acceleratorUnknown =
      !!accelerators?.length && !normalizeAccelerators(accelerators)?.length
    return osUnknown || acceleratorUnknown
  })
}

function compatibilityConflicts(
  pack: NodePack,
  environment: SystemEnvironment
) {
  return [pack, pack.latest_version]
    .filter(
      (source): source is NodePack | NonNullable<NodePack['latest_version']> =>
        source !== undefined
    )
    .flatMap((source) => {
      const { isBanned, isPending } = deriveStatusFlags(source.status)
      return evaluateCompatibility(
        {
          supported_os: normalizeOSList(source.supported_os),
          supported_accelerators: normalizeAccelerators(
            source.supported_accelerators
          ),
          supported_comfyui_version: source.supported_comfyui_version,
          supported_comfyui_frontend_version:
            source.supported_comfyui_frontend_version,
          isBanned,
          isPending
        },
        environment
      )
    })
}

function resolveEligibility(
  pack: NodePack,
  environment: SystemEnvironment
): TemplateCustomNodeEligibility {
  if (pack.status === undefined) return { status: 'unknown' }
  if (pack.status !== 'NodeStatusActive') {
    return { status: 'unavailable', reason: 'unsafe' }
  }

  const version = pack.latest_version
  if (!version?.version) {
    return { status: 'unavailable', reason: 'invalid-payload' }
  }
  if (version.status === undefined) return { status: 'unknown' }
  if (
    version.status !== 'NodeVersionStatusActive' ||
    version.deprecated === true
  ) {
    return { status: 'unavailable', reason: 'unsafe' }
  }
  if (pack.publisher?.name === 'Unclaimed' && !pack.repository) {
    return { status: 'unavailable', reason: 'invalid-payload' }
  }
  if (
    hasUnknownEnvironmentRequirement(pack, environment) ||
    hasUnrecognizedCompatibilityValue(pack)
  ) {
    return { status: 'unknown' }
  }
  if (compatibilityConflicts(pack, environment).length) {
    return { status: 'unavailable', reason: 'incompatible' }
  }
  return { status: 'eligible', pack }
}

function isCompleteRegistryResponse(
  response: RegistryListResponse,
  requestedIds: readonly string[]
): boolean {
  const nodes = response.nodes ?? []
  const returnedIds = nodes.flatMap((node) => (node.id ? [node.id] : []))
  return (
    response.page === 1 &&
    response.total !== undefined &&
    response.total === nodes.length &&
    (response.totalPages ?? 1) <= 1 &&
    returnedIds.length === nodes.length &&
    new Set(returnedIds).size === returnedIds.length &&
    returnedIds.every((id) => requestedIds.includes(id))
  )
}

function managerCapabilityFromState(
  state: ManagerUIState
): TemplateCustomNodeManagerCapability {
  switch (state) {
    case ManagerUIState.NEW_UI:
      return 'ready'
    case ManagerUIState.LEGACY_UI:
      return 'legacy'
    case ManagerUIState.INCOMPATIBLE:
      return 'incompatible'
    default:
      return 'disabled'
  }
}

function createDefaultDependencies(): TemplateCustomNodeAvailabilityDependencies {
  const managerState = useManagerState()
  const managerService = useComfyManagerService()
  const managerStore = useComfyManagerStore()
  const registryService = useComfyRegistryService()
  const systemStatsStore = useSystemStatsStore()

  return {
    getManagerCapability: () =>
      managerCapabilityFromState(managerState.managerUIState.value),
    listInstalledPacks: managerService.listInstalledPacks,
    isPackInstalling: managerStore.isPackInstalling,
    listRegistryPacks: (ids, signal) =>
      registryService.listAllPacks(
        {
          node_id: [...ids],
          include_banned: true,
          page: 1,
          limit: Math.max(1, ids.length)
        },
        signal
      ),
    getEnvironment: () => ({
      comfyui_version: systemStatsStore.systemStats?.system.comfyui_version,
      frontend_version: getFrontendVersion(),
      os: systemStatsStore.systemStats?.system.os,
      accelerator: systemStatsStore.systemStats?.devices?.[0]?.type
    })
  }
}

export function useTemplateCustomNodeAvailability(
  dependencies: TemplateCustomNodeAvailabilityDependencies = createDefaultDependencies()
) {
  async function resolveAvailability(
    ids: readonly string[],
    signal?: AbortSignal
  ): Promise<ResolvedTemplateCustomNodeAvailability[]> {
    const managerCapability = dependencies.getManagerCapability()
    const unknownSnapshot = {
      managerCapability,
      installedInventory: { isComplete: false, entries: [] },
      inProgressIds: ids.filter(dependencies.isPackInstalling),
      registry: { isComplete: false, eligibilityById: {} }
    } as const

    if (signal?.aborted || managerCapability !== 'ready') {
      return resolveTemplateCustomNodeAvailability(ids, unknownSnapshot)
    }

    const installed = await dependencies.listInstalledPacks(signal)
    if (signal?.aborted || installed === null) {
      return resolveTemplateCustomNodeAvailability(ids, unknownSnapshot)
    }

    const entries = Object.values(installed).flatMap((pack) => {
      const id = pack.cnr_id ?? pack.aux_id
      return id ? [{ id, enabled: pack.enabled === true }] : []
    })
    const installedIds = new Set(entries.map((entry) => entry.id))
    const missingIds = ids.filter((id) => !installedIds.has(id))
    if (!missingIds.length) {
      return resolveTemplateCustomNodeAvailability(ids, {
        ...unknownSnapshot,
        installedInventory: { isComplete: true, entries }
      })
    }

    const registry = await dependencies.listRegistryPacks(missingIds, signal)
    if (signal?.aborted || registry === null) {
      return resolveTemplateCustomNodeAvailability(ids, {
        ...unknownSnapshot,
        installedInventory: { isComplete: true, entries }
      })
    }

    const registryComplete = isCompleteRegistryResponse(registry, missingIds)
    const environment = dependencies.getEnvironment()
    const eligibilityById = Object.fromEntries(
      (registry.nodes ?? []).flatMap((pack) =>
        pack.id ? [[pack.id, resolveEligibility(pack, environment)]] : []
      )
    )

    return resolveTemplateCustomNodeAvailability(ids, {
      managerCapability,
      installedInventory: { isComplete: true, entries },
      inProgressIds: unknownSnapshot.inProgressIds,
      registry: { isComplete: registryComplete, eligibilityById }
    })
  }

  return { resolveAvailability }
}
