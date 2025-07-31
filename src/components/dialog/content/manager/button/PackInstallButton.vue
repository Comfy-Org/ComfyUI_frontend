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
import { t } from '@/i18n'
import { useDialogService } from '@/services/dialogService'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import { IsInstallingKey } from '@/types/comfyManagerTypes'
import type { components } from '@/types/comfyRegistryTypes'
import {
  type ConflictDetail,
  type ConflictDetectionResult
} from '@/types/conflictDetectionTypes'
import { components as ManagerComponents } from '@/types/generatedManagerTypes'

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

const installAllPacks = async () => {
  if (!nodePacks?.length) return

  if (hasConflict && conflictInfo) {
    const conflictedPackages: ConflictDetectionResult[] = nodePacks.map(
      (pack) => ({
        package_id: pack.id || '',
        package_name: pack.name || '',
        has_conflict: true,
        conflicts: conflictInfo || [],
        is_compatible: false
      })
    )

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
