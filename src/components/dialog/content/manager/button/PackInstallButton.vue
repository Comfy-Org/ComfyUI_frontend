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
    @action="installAllPacks"
    @click="onClick"
  />
</template>

<script setup lang="ts">
import { inject, ref } from 'vue'

import PackActionButton from '@/components/dialog/content/manager/button/PackActionButton.vue'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import {
  IsInstallingKey,
  ManagerChannel,
  ManagerDatabaseSource,
  SelectedVersion
} from '@/types/comfyManagerTypes'
import type { components } from '@/types/comfyRegistryTypes'

type NodePack = components['schemas']['Node']

const { nodePacks, variant, label } = defineProps<{
  nodePacks: NodePack[]
  variant?: 'default' | 'black'
  label?: string
}>()

const isInstalling = inject(IsInstallingKey, ref(false))

const onClick = (): void => {
  isInstalling.value = true
}

const managerStore = useComfyManagerStore()

const createPayload = (installItem: NodePack) => {
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
  if (!nodePacks?.length) {
    console.warn('No packs provided for installation')
    return
  }

  isInstalling.value = true

  const uninstalledPacks = nodePacks.filter(
    (pack) => !managerStore.isPackInstalled(pack.id)
  )

  if (!uninstalledPacks.length) {
    console.info('All packs are already installed')
    isInstalling.value = false
    return
  }

  console.info(`Starting installation of ${uninstalledPacks.length} packs`)

  try {
    await Promise.all(uninstalledPacks.map(installPack))
    managerStore.installPack.clear()
    console.info('All packs installed successfully')
  } catch (error) {
    console.error('Pack installation failed:', error)
    console.error(
      'Failed packs info:',
      uninstalledPacks.map((p) => p.id)
    )
  } finally {
    isInstalling.value = false
  }
}
</script>
