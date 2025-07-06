<template>
  <div v-if="nodePacks?.length" class="flex flex-col items-center mb-6">
    <slot name="thumbnail">
      <PackIcon :node-pack="nodePacks[0]" width="24" height="24" />
    </slot>
    <h2
      class="text-2xl font-bold text-center mt-4 mb-2"
      style="word-break: break-all"
    >
      <slot name="title">
        {{ nodePacks[0].name }}
      </slot>
    </h2>
    <div class="mt-2 mb-4 w-full max-w-xs flex justify-center">
      <slot name="install-button">
        <PackUninstallButton
          v-if="isAllInstalled"
          v-bind="$attrs"
          :node-packs="nodePacks"
        />
        <PackInstallButton v-else v-bind="$attrs" :node-packs="nodePacks" />
      </slot>
    </div>
  </div>
  <div v-else class="flex flex-col items-center mb-6">
    <NoResultsPlaceholder
      :message="$t('manager.status.unknown')"
      :title="$t('manager.tryAgainLater')"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import PackInstallButton from '@/components/dialog/content/manager/button/PackInstallButton.vue'
import PackUninstallButton from '@/components/dialog/content/manager/button/PackUninstallButton.vue'
import PackIcon from '@/components/dialog/content/manager/packIcon/PackIcon.vue'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import { components } from '@/types/comfyRegistryTypes'

const { nodePacks } = defineProps<{
  nodePacks: components['schemas']['Node'][]
}>()

const managerStore = useComfyManagerStore()

const isAllInstalled = ref(false)
watch(
  [() => nodePacks, () => managerStore.installedPacks],
  () => {
    isAllInstalled.value = nodePacks.every((nodePack) =>
      managerStore.isPackInstalled(nodePack.id)
    )
  },
  { immediate: true }
)
</script>
