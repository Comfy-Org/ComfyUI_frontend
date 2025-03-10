<template>
  <div v-if="nodePack" class="flex flex-col items-center mb-6">
    <slot name="thumbnail">
      <PackIcon :node-pack="nodePack" width="24" height="24" />
    </slot>
    <h2
      class="text-2xl font-bold text-center mt-4 mb-2"
      style="word-break: break-all"
    >
      <slot name="title">{{ nodePack?.name }}</slot>
    </h2>
    <div class="mt-2 mb-4 w-full max-w-xs flex justify-center">
      <slot name="install-button">
        <PackInstallButton
          v-if="nodePack"
          :nodePacks="[
            {
              nodePack: nodePack,
              selectedVersion: selectedVersion
            }
          ]"
          :full-width="installButtonFullWidth"
        />
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
import { ref } from 'vue'

import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import PackInstallButton from '@/components/dialog/content/manager/PackInstallButton.vue'
import PackIcon from '@/components/dialog/content/manager/packIcon/PackIcon.vue'
import { SelectedVersion } from '@/types/comfyManagerTypes'
import { components } from '@/types/comfyRegistryTypes'

const {
  nodePack,
  installButtonFullWidth = false,
  version = SelectedVersion.LATEST
} = defineProps<{
  nodePack?: components['schemas']['Node']
  installButtonFullWidth?: boolean
  version?: string
}>()

const selectedVersion = ref<string>(
  version || nodePack?.latest_version?.version || SelectedVersion.LATEST
)

defineExpose({
  updateVersion: (newVersion: string) => {
    selectedVersion.value = newVersion
  }
})
</script>
