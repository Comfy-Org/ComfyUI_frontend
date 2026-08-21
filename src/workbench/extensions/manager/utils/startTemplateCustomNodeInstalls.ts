import { t } from '@/i18n'
import type { ResolvedTemplateCustomNodeAvailability } from '@/platform/workflow/templates/utils/templateCustomNodeAvailability'
import type { components } from '@/types/comfyRegistryTypes'
import type { components as ManagerComponents } from '@/workbench/extensions/manager/types/generatedManagerTypes'

import { useComfyManagerStore } from '../stores/comfyManagerStore'
import { createPackInstallPayload } from './packInstallPayload'

type NodePack = components['schemas']['Node']
type InstallPackParams = ManagerComponents['schemas']['InstallPackParams']

export type TemplateCustomNodeInstallDependencies = {
  createPayload: (pack: NodePack) => InstallPackParams
  installPack: (params: InstallPackParams) => Promise<unknown>
  clearInstallCache: () => void
  reportUnexpectedError: (error: unknown) => void
}

function createDefaultDependencies(): TemplateCustomNodeInstallDependencies {
  const managerStore = useComfyManagerStore()
  return {
    createPayload: (pack) =>
      createPackInstallPayload(pack, t('manager.packInstall.nodeIdRequired')),
    installPack: managerStore.installPack.call,
    clearInstallCache: managerStore.installPack.clear,
    reportUnexpectedError: (error) => {
      console.error('[template custom nodes] Install handoff failed:', error)
    }
  }
}

export function startTemplateCustomNodeInstalls(
  availability: readonly ResolvedTemplateCustomNodeAvailability[],
  dependencies: TemplateCustomNodeInstallDependencies = createDefaultDependencies()
): string[] {
  const startedIds: string[] = []
  const seenIds = new Set<string>()

  for (const item of availability) {
    if (item.status !== 'missing' || seenIds.has(item.id)) continue
    seenIds.add(item.id)

    try {
      const payload = dependencies.createPayload(item.pack)
      const request = dependencies.installPack(payload)
      void request
        .catch(dependencies.reportUnexpectedError)
        .finally(dependencies.clearInstallCache)
      startedIds.push(item.id)
    } catch (error) {
      dependencies.reportUnexpectedError(error)
    }
  }

  return startedIds
}
