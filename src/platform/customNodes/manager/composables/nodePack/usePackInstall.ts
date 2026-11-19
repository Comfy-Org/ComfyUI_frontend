import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { components } from '@/types/comfyRegistryTypes'
import type { components as ManagerComponents } from '@comfyorg/api-client/generatedManagerTypes'
import { useConflictDetection } from '@/platform/customNodes/manager/composables/useConflictDetection'
import { useNodeConflictDialog } from '@/platform/customNodes/manager/composables/dialogs/useNodeConflictDialog'
import { useComfyManagerStore } from '@/platform/customNodes/manager/stores/comfyManagerStore'
import type { NodePackId } from '@/platform/customNodes/manager/types/comfyManagerTypes'
import type { ConflictDetail } from '@/platform/customNodes/manager/types/conflictDetectionTypes'

type NodePack = components['schemas']['Node']

/** The queue params that install the latest version of a pack. */
export function createInstallParams(
  pack: NodePack & { id: NodePackId }
): ManagerComponents['schemas']['InstallPackParams'] {
  const isUnclaimedPack = pack.publisher?.name === 'Unclaimed'
  const versionToInstall = isUnclaimedPack
    ? 'nightly'
    : (pack.latest_version?.version ?? 'latest')

  return {
    id: pack.id,
    repository: pack.repository ?? '',
    channel: 'dev',
    mode: 'cache',
    selected_version: versionToInstall,
    version: versionToInstall
  }
}

export function usePackInstall(
  getNodePacks: () => NodePack[],
  getHasConflict?: () => boolean | undefined,
  getConflictInfo?: () => ConflictDetail[] | undefined
) {
  const managerStore = useComfyManagerStore()
  const { show: showNodeConflictDialog } = useNodeConflictDialog()
  const { checkNodeCompatibility } = useConflictDetection()
  const { t } = useI18n()

  // Check if any of the packs are currently being installed
  const isInstalling = computed(() => {
    const nodePacks = getNodePacks()
    if (!nodePacks.length) return false
    return nodePacks.some((pack) => managerStore.isPackInstalling(pack.id))
  })

  const createPayload = (installItem: NodePack) => {
    const { id } = installItem
    if (!id) {
      console.error(t('manager.packInstall.nodeIdRequired'))
      return
    }
    return createInstallParams({ ...installItem, id })
  }

  const installPack = (item: NodePack) => {
    const payload = createPayload(item)
    if (!payload) return Promise.resolve()
    return managerStore.installPack.call(payload)
  }

  const performInstallation = async (packs: NodePack[]) => {
    try {
      const results = await Promise.allSettled(packs.map(installPack))
      const failures = results.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected'
      )
      if (failures.length) {
        console.error(
          '[usePackInstall] Some installations failed:',
          failures.map((f) => f.reason)
        )
      }
    } finally {
      managerStore.installPack.clear()
    }
  }

  const installAllPacks = async () => {
    const nodePacks = getNodePacks()
    if (!nodePacks.length) return

    const hasConflict = getHasConflict?.()
    const conflictInfo = getConflictInfo?.()

    if (hasConflict) {
      if (!conflictInfo) return

      const conflictedPackages = nodePacks
        .map((pack) => {
          const compatibilityCheck = checkNodeCompatibility(pack)
          return {
            package_id: pack.id || '',
            package_name: pack.name || '',
            has_conflict: compatibilityCheck.hasConflict,
            conflicts: compatibilityCheck.conflicts,
            is_compatible: !compatibilityCheck.hasConflict
          }
        })
        .filter((result) => result.has_conflict)

      showNodeConflictDialog({
        conflictedPackages,
        buttonText: t('manager.conflicts.installAnyway'),
        onButtonClick: async () => {
          const uninstalledPacks = nodePacks.filter(
            (pack) => !managerStore.isPackInstalled(pack.id)
          )
          if (!uninstalledPacks.length) return
          await performInstallation(uninstalledPacks)
        }
      })
      return
    }

    const uninstalledPacks = nodePacks.filter(
      (pack) => !managerStore.isPackInstalled(pack.id)
    )
    if (!uninstalledPacks.length) return
    await performInstallation(uninstalledPacks)
  }

  return { isInstalling, installAllPacks, performInstallation }
}
