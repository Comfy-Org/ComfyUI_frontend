import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { components } from '@/types/comfyRegistryTypes'
import type { components as ManagerComponents } from '@/workbench/extensions/manager/types/generatedManagerTypes'
import { useConflictDetection } from '@/workbench/extensions/manager/composables/useConflictDetection'
import { useNodeConflictDialog } from '@/workbench/extensions/manager/composables/useNodeConflictDialog'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'
import type { ConflictDetail } from '@/workbench/extensions/manager/types/conflictDetectionTypes'

type NodePack = components['schemas']['Node']

/**
 * Composable that encapsulates node pack install logic.
 * Extracted from PackInstallButton to enable reuse across custom-styled buttons.
 *
 * @param getNodePacks - Reactive getter returning the list of packs to install
 * @param getHasConflict - Optional getter for external conflict flag (mirrors PackInstallButton's hasConflict prop)
 * @param getConflictInfo - Optional getter for pre-computed conflict details (mirrors PackInstallButton's conflictInfo prop)
 */
export function usePackInstall(
  getNodePacks: () => NodePack[],
  getHasConflict?: () => boolean | undefined,
  getConflictInfo?: () => ConflictDetail[] | undefined
) {
  const managerStore = useComfyManagerStore()
  const { show: showNodeConflictDialog } = useNodeConflictDialog()
  const { t } = useI18n()

  // Check if any of the packs are currently being installed
  const isInstalling = computed(() => {
    const nodePacks = getNodePacks()
    if (!nodePacks?.length) return false
    return nodePacks.some((pack) => managerStore.isPackInstalling(pack.id))
  })

  const createPayload = (installItem: NodePack) => {
    if (!installItem.id) {
      throw new Error('Node ID is required for installation')
    }

    const isUnclaimedPack = installItem.publisher?.name === 'Unclaimed'
    const versionToInstall = isUnclaimedPack
      ? ('nightly' as ManagerComponents['schemas']['SelectedVersion'])
      : (installItem.latest_version?.version ??
        ('latest' as ManagerComponents['schemas']['SelectedVersion']))

    return {
      id: installItem.id,
      repository: installItem.repository ?? '',
      channel: 'dev' as ManagerComponents['schemas']['ManagerChannel'],
      mode: 'cache' as ManagerComponents['schemas']['ManagerDatabaseSource'],
      selected_version: versionToInstall,
      version: versionToInstall
    }
  }

  const installPack = (item: NodePack) =>
    managerStore.installPack.call(createPayload(item))

  const performInstallation = async (packs: NodePack[]) => {
    await Promise.all(packs.map(installPack))
    managerStore.installPack.clear()
  }

  const installAllPacks = async () => {
    const nodePacks = getNodePacks()
    if (!nodePacks?.length) return

    const hasConflict = getHasConflict?.()
    const conflictInfo = getConflictInfo?.()

    if (hasConflict && conflictInfo) {
      // Check each package individually for conflicts
      const { checkNodeCompatibility } = useConflictDetection()
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
        .filter((result) => result.has_conflict) // Only show packages with conflicts

      showNodeConflictDialog({
        conflictedPackages,
        buttonText: t('manager.conflicts.installAnyway'),
        onButtonClick: async () => {
          // Proceed with installation of uninstalled packages
          const uninstalledPacks = nodePacks.filter(
            (pack) => !managerStore.isPackInstalled(pack.id)
          )
          if (!uninstalledPacks.length) return
          await performInstallation(uninstalledPacks)
        }
      })
      return
    }

    // No conflicts or conflicts acknowledged - proceed with installation
    const uninstalledPacks = nodePacks.filter(
      (pack) => !managerStore.isPackInstalled(pack.id)
    )
    if (!uninstalledPacks.length) return
    await performInstallation(uninstalledPacks)
  }

  return { isInstalling, installAllPacks, performInstallation }
}
