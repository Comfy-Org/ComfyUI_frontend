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
import { IsInstallingKey } from '@/types/comfyManagerTypes'
import type { components } from '@/types/comfyRegistryTypes'
import { components as ManagerComponents } from '@/types/generatedManagerTypes'

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
  if (!nodePacks?.length) {
    console.warn('No packs provided for installation')
    return
  }

  // isInstalling.value = true

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
