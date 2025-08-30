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
    <template v-if="isLoading || isInstalling" #icon>
      <DotSpinner duration="1s" :size="size === 'sm' ? 12 : 16" />
    </template>
  </IconTextButton>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import IconTextButton from '@/components/button/IconTextButton.vue'
import DotSpinner from '@/components/common/DotSpinner.vue'
import { t } from '@/i18n'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import { ButtonSize } from '@/types/buttonTypes'
import {
  ManagerChannel,
  ManagerDatabaseSource,
  SelectedVersion
} from '@/types/comfyManagerTypes'
import type { components } from '@/types/comfyRegistryTypes'

type NodePack = components['schemas']['Node']

const {
  nodePacks,
  isLoading = false,
  isInstalling = false,
  label = 'Install',
  size = 'sm'
} = defineProps<{
  nodePacks: NodePack[]
  isLoading?: boolean
  isInstalling?: boolean
  label?: string
  size?: ButtonSize
}>()

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
  if (!nodePacks?.length) return

  const uninstalledPacks = nodePacks.filter(
    (pack) => !managerStore.isPackInstalled(pack.id)
  )
  if (!uninstalledPacks.length) return

  await Promise.all(uninstalledPacks.map(installPack))
  managerStore.installPack.clear()
}

const computedLabel = computed(() =>
  isInstalling
    ? t('g.installing')
    : label ??
      (nodePacks.length > 1 ? t('manager.installSelected') : t('g.install'))
)
</script>
