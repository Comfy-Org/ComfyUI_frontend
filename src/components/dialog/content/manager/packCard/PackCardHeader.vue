<template>
  <div v-if="nodePack" class="flex flex-col items-center mb-6">
    <slot name="thumbnail">
      <PackIcon :node-pack="nodePack" width="24" height="24" />
    </slot>
    <h2
      class="text-2xl font-bold text-center mt-4 mb-2"
      style="word-break: break-all"
    >
      <slot name="title">
        {{ nodePack?.name }}
      </slot>
    </h2>
    <div class="mt-2 mb-4 w-full max-w-xs flex justify-center">
      <slot name="install-button">
        <PackUninstallButton
          v-if="isPackInstalled"
          :node-packs="[nodePack]"
          :full-width="installButtonFullWidth"
        />

        <PackInstallButton
          v-else
          :node-packs="[nodePack]"
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
import { computed } from 'vue'

import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import PackInstallButton from '@/components/dialog/content/manager/button/PackInstallButton.vue'
import PackUninstallButton from '@/components/dialog/content/manager/button/PackUninstallButton.vue'
import PackIcon from '@/components/dialog/content/manager/packIcon/PackIcon.vue'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import { components } from '@/types/comfyRegistryTypes'

const { nodePack, installButtonFullWidth = false } = defineProps<{
  nodePack?: components['schemas']['Node']
  installButtonFullWidth?: boolean
}>()

const managerStore = useComfyManagerStore()

const isPackInstalled = computed(() =>
  nodePack ? managerStore.isPackInstalled(nodePack.id) : false
)
</script>
