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

import PackActionButton from '@/components/dialog/content/manager/button/PackActionButton.vue'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import { IsInstallingKey } from '@/types/comfyManagerTypes'
import type { components } from '@/types/comfyRegistryTypes'
import { components as ManagerComponents } from '@/types/generatedManagerTypes'

type NodePack = components['schemas']['Node']

const { nodePacks, variant, label, hasConflict } = defineProps<{
  nodePacks: NodePack[]
  variant?: 'default' | 'black'
  label?: string
  hasConflict?: boolean
}>()

const isInstalling = inject(IsInstallingKey, ref(false))
const managerStore = useComfyManagerStore()

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

const installAllPacks = async () => {
  if (!nodePacks?.length) return

  // TBD Install Anyway modal
  // if (hasConflict && !isConflictAcknowledged) {
  // showNodeConflictDialog({
  //   conflictedPackages: nodePacks,
  //   buttonText: t('manager.conflicts.installAnyway'),
  //   onButtonClick: async () => {
  //     // User chose "Install Anyway" - acknowledge all conflicts and proceed
  //     for (const conflictedPack of packsWithConflicts) {
  //       for (const conflict of conflictedPack.conflicts) {
  //         acknowledgeConflict(
  //           conflictedPack.package_id,
  //           conflict.type,
  //           '0.1.0'
  //         )
  //       }
  //     }
  //     // Proceed with installation
  //     await performInstallation(uninstalledPacks)
  //   }
  // })
  // return
  // }

  const uninstalledPacks = nodePacks.filter(
    (pack) => !managerStore.isPackInstalled(pack.id)
  )
  if (!uninstalledPacks.length) return

  // No conflicts or conflicts acknowledged - proceed with installation
  await performInstallation(uninstalledPacks)
}

const performInstallation = async (packs: NodePack[]) => {
  await Promise.all(packs.map(installPack))
  managerStore.installPack.clear()
}
</script>
