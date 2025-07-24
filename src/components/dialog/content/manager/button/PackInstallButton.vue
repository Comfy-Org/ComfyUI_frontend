<template>
  <PackActionButton
    v-bind="$attrs"
    :label="
      label ??
      (nodePacks.length > 1 ? $t('manager.installSelected') : $t('g.install'))
    "
    :severity="variant === 'black' ? undefined : 'secondary'"
    :variant="variant"
    :loading="isInstalling"
    :loading-message="$t('g.installing')"
    :has-warning="hasConflict"
    @action="installAllPacks"
    @click="onClick"
  />
</template>

<script setup lang="ts">
import { inject, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import PackActionButton from '@/components/dialog/content/manager/button/PackActionButton.vue'
import { useConflictAcknowledgment } from '@/composables/useConflictAcknowledgment'
import { useConflictDetection } from '@/composables/useConflictDetection'
import { useDialogService } from '@/services/dialogService'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import { IsInstallingKey } from '@/types/comfyManagerTypes'
import type { components } from '@/types/comfyRegistryTypes'
import type { ConflictDetectionResult } from '@/types/conflictDetectionTypes'
import { components as ManagerComponents } from '@/types/generatedManagerTypes'

type NodePack = components['schemas']['Node']

const { nodePacks, variant, label, hasConflict, skipConflictCheck } =
  defineProps<{
    nodePacks: NodePack[]
    variant?: 'default' | 'black'
    label?: string
    hasConflict?: boolean
    skipConflictCheck?: boolean
  }>()

const { t } = useI18n()
const isInstalling = inject(IsInstallingKey, ref(false))
const managerStore = useComfyManagerStore()
const { showNodeConflictDialog } = useDialogService()
const { checkVersionCompatibility } = useConflictDetection()
const { acknowledgeConflict, isConflictAcknowledged } =
  useConflictAcknowledgment()

const onClick = (): void => {
  isInstalling.value = true
}

const createPayload = (
  installItem: NodePack
): ManagerComponents['schemas']['InstallPackParams'] => {
  if (!installItem.id) {
    throw new Error('Node ID is required for installation')
  }

  const isUnclaimedPack = installItem.publisher?.name === 'Unclaimed'
  const versionToInstall = isUnclaimedPack
    ? ('nightly' as ManagerComponents['schemas']['SelectedVersion'])
    : installItem.latest_version?.version ??
      ('latest' as ManagerComponents['schemas']['SelectedVersion'])

  return {
    id: installItem.id,
    version: versionToInstall,
    repository: installItem.repository ?? '',
    channel: 'dev' as ManagerComponents['schemas']['ManagerChannel'],
    mode: 'cache' as ManagerComponents['schemas']['ManagerDatabaseSource'],
    selected_version: versionToInstall
  }
}

const installPack = (item: NodePack) =>
  managerStore.installPack.call(createPayload(item))

// Function to check compatibility for uninstalled packages using centralized logic
function checkUninstalledPackageCompatibility(
  pack: NodePack
): ConflictDetectionResult | null {
  const compatibility = checkVersionCompatibility({
    supported_os: pack.supported_os,
    supported_accelerators: pack.supported_accelerators,
    supported_comfyui_version: pack.supported_comfyui_version,
    supported_comfyui_frontend_version: pack.supported_comfyui_frontend_version
  })

  if (compatibility.hasConflict) {
    return {
      package_id: pack.id || 'unknown',
      package_name: pack.name || 'unknown',
      has_conflict: true,
      conflicts: compatibility.conflicts,
      is_compatible: false
    }
  }

  return null
}

const installAllPacks = async () => {
  if (!nodePacks?.length) return

  const uninstalledPacks = nodePacks.filter(
    (pack) => !managerStore.isPackInstalled(pack.id)
  )
  if (!uninstalledPacks.length) return

  // Skip conflict check if explicitly requested (e.g., from "Install Anyway" button)
  if (!skipConflictCheck) {
    // Check for conflicts in uninstalled packages
    const packsWithConflicts: ConflictDetectionResult[] = []

    for (const pack of uninstalledPacks) {
      const conflicts = checkUninstalledPackageCompatibility(pack)
      if (conflicts) {
        // Check if conflicts have been acknowledged
        const hasUnacknowledgedConflicts = conflicts.conflicts.some(
          (conflict) => !isConflictAcknowledged(pack.id || '', conflict.type)
        )

        if (hasUnacknowledgedConflicts) {
          packsWithConflicts.push(conflicts)
        }
      }
    }

    // If there are unacknowledged conflicts, show modal
    if (packsWithConflicts.length > 0) {
      showNodeConflictDialog({
        conflictedPackages: packsWithConflicts,
        buttonText: t('manager.conflicts.installAnyway'),
        onButtonClick: async () => {
          // User chose "Install Anyway" - acknowledge all conflicts and proceed
          for (const conflictedPack of packsWithConflicts) {
            for (const conflict of conflictedPack.conflicts) {
              acknowledgeConflict(
                conflictedPack.package_id,
                conflict.type,
                '0.1.0'
              )
            }
          }
          // Proceed with installation
          await performInstallation(uninstalledPacks)
        }
      })
      return
    }
  }

  // No conflicts or conflicts acknowledged - proceed with installation
  await performInstallation(uninstalledPacks)
}

const performInstallation = async (packs: NodePack[]) => {
  await Promise.all(packs.map(installPack))
  managerStore.installPack.clear()
}
</script>
