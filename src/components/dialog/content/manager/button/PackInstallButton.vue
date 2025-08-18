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
  />
</template>

<script setup lang="ts">
import { inject, ref } from 'vue'

import PackActionButton from '@/components/dialog/content/manager/button/PackActionButton.vue'
import { useConflictDetection } from '@/composables/useConflictDetection'
import { t } from '@/i18n'
import { useDialogService } from '@/services/dialogService'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import {
  IsInstallingKey,
  ManagerChannel,
  ManagerDatabaseSource,
  SelectedVersion
} from '@/types/comfyManagerTypes'
import type { components } from '@/types/comfyRegistryTypes'
import {
  type ConflictDetail,
  ConflictDetectionResult
} from '@/types/conflictDetectionTypes'

type NodePack = components['schemas']['Node']

const { nodePacks, variant, label, hasConflict, conflictInfo } = defineProps<{
  nodePacks: NodePack[]
  variant?: 'default' | 'black'
  label?: string
  hasConflict?: boolean
  conflictInfo?: ConflictDetail[]
}>()

const isInstalling = inject(IsInstallingKey, ref(false))

const managerStore = useComfyManagerStore()
const { showNodeConflictDialog } = useDialogService()

const createPayload = (installItem: NodePack) => {
  if (!installItem.id) {
    throw new Error('Node ID is required for installation')
  }

  const isUnclaimedPack = installItem.publisher?.name === 'Unclaimed'
  const versionToInstall = isUnclaimedPack
    ? SelectedVersion.NIGHTLY
    : installItem.latest_version?.version ?? SelectedVersion.LATEST

  return {
    id: installItem.id,
    repository: installItem.repository ?? '',
    channel: ManagerChannel.DEV,
    mode: ManagerDatabaseSource.CACHE,
    selected_version: versionToInstall,
    version: versionToInstall
  }
}

const installPack = (item: NodePack) =>
  managerStore.installPack.call(createPayload(item))

const installAllPacks = async () => {
  if (!nodePacks?.length) return

  if (hasConflict && conflictInfo) {
    // Check each package individually for conflicts
    const { checkNodeCompatibility } = useConflictDetection()
    const conflictedPackages: ConflictDetectionResult[] = nodePacks
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
        // Proceed with installation
        isInstalling.value = true
        await performInstallation(nodePacks)
      }
    })
    return
  }
  // No conflicts or conflicts acknowledged - proceed with installation
  isInstalling.value = true
  await performInstallation(nodePacks)
}

const performInstallation = async (packs: NodePack[]) => {
  await Promise.all(packs.map(installPack))
  managerStore.installPack.clear()
}
</script>
