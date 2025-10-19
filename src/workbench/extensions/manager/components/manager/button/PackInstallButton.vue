<template>
  <IconTextButton
    v-bind="$attrs"
    type="transparent"
    :label="computedLabel"
    :border="true"
    :size="size"
    :disabled="isLoading || isInstalling"
    @click="installAllPacks"
  >
    <template #icon>
      <i
        v-if="hasConflict && !isInstalling && !isLoading"
        class="pi pi-exclamation-triangle text-yellow-500"
      />
      <DotSpinner
        v-else-if="isLoading || isInstalling"
        duration="1s"
        :size="size === 'sm' ? 12 : 16"
      />
    </template>
  </IconTextButton>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import IconTextButton from '@/components/button/IconTextButton.vue'
import DotSpinner from '@/components/common/DotSpinner.vue'
import { t } from '@/i18n'
import { useDialogService } from '@/services/dialogService'
import type { ButtonSize } from '@/types/buttonTypes'
import type { components } from '@/types/comfyRegistryTypes'
import { useConflictDetection } from '@/workbench/extensions/manager/composables/useConflictDetection'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'
import type {
  ConflictDetail,
  ConflictDetectionResult
} from '@/workbench/extensions/manager/types/conflictDetectionTypes'
import type { components as ManagerComponents } from '@/workbench/extensions/manager/types/generatedManagerTypes'

type NodePack = components['schemas']['Node']

const {
  nodePacks,
  isLoading = false,
  label = 'Install',
  size = 'sm',
  hasConflict,
  conflictInfo
} = defineProps<{
  nodePacks: NodePack[]
  isLoading?: boolean
  label?: string
  size?: ButtonSize
  hasConflict?: boolean
  conflictInfo?: ConflictDetail[]
}>()

const managerStore = useComfyManagerStore()
const { showNodeConflictDialog } = useDialogService()

// Check if any of the packs are currently being installed
const isInstalling = computed(() => {
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

const performInstallation = async (packs: NodePack[]) => {
  await Promise.all(packs.map(installPack))
  managerStore.installPack.clear()
}

const computedLabel = computed(() =>
  isInstalling.value
    ? t('g.installing')
    : (label ??
      (nodePacks.length > 1 ? t('manager.installSelected') : t('g.install')))
)
</script>
