<template>
  <div v-if="nodePacks?.length" class="flex flex-col h-full">
    <div class="p-6 flex-1 overflow-auto">
      <InfoPanelHeader :node-packs>
        <template #thumbnail>
          <PackIconStacked :node-packs="nodePacks" />
        </template>
        <template #title>
          {{ nodePacks.length }}
          {{ $t('manager.packsSelected') }}
        </template>
        <template #install-button>
          <PackUninstallButton
            v-if="isAllInstalled"
            v-bind="$attrs"
            size="md"
            :node-packs="nodePacks"
          />
          <PackInstallButton
            v-else
            v-bind="$attrs"
            size="md"
            :is-installing="isInstalling"
            :node-packs="nodePacks"
          />
        </template>
      </InfoPanelHeader>
      <div class="mb-6">
        <MetadataRow :label="$t('g.status')">
          <PackStatusMessage status-type="NodeVersionStatusActive" />
        </MetadataRow>
        <MetadataRow
          :label="$t('manager.totalNodes')"
          :value="totalNodesCount"
        />
      </div>
    </div>
  </div>
  <div v-else class="mt-4 mx-8 flex-1 overflow-hidden text-sm">
    {{ $t('manager.infoPanelEmpty') }}
  </div>
</template>

<script setup lang="ts">
import { useAsyncState } from '@vueuse/core'
import { computed, onUnmounted, ref, watch } from 'vue'

import PackStatusMessage from '@/components/dialog/content/manager/PackStatusMessage.vue'
import PackInstallButton from '@/components/dialog/content/manager/button/PackInstallButton.vue'
import PackUninstallButton from '@/components/dialog/content/manager/button/PackUninstallButton.vue'
import InfoPanelHeader from '@/components/dialog/content/manager/infoPanel/InfoPanelHeader.vue'
import MetadataRow from '@/components/dialog/content/manager/infoPanel/MetadataRow.vue'
import PackIconStacked from '@/components/dialog/content/manager/packIcon/PackIconStacked.vue'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import { useComfyRegistryStore } from '@/stores/comfyRegistryStore'
import { components } from '@/types/comfyRegistryTypes'

const { nodePacks } = defineProps<{
  nodePacks: components['schemas']['Node'][]
}>()

const { getNodeDefs } = useComfyRegistryStore()
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

// Check if any of the packs are currently being installed
const isInstalling = computed(() => {
  if (!nodePacks?.length) return false
  return nodePacks.some((pack) => managerStore.isPackInstalling(pack.id))
})

const getPackNodes = async (pack: components['schemas']['Node']) => {
  if (!pack.latest_version?.version) return []
  const nodeDefs = await getNodeDefs.call({
    packId: pack.id,
    version: pack.latest_version?.version,
    // Fetch all nodes.
    // TODO: Render all nodes previews and handle pagination.
    // For determining length, use the `totalNumberOfPages` field of response
    limit: 8192
  })
  return nodeDefs?.comfy_nodes ?? []
}

const { state: allNodeDefs } = useAsyncState(
  () => Promise.all(nodePacks.map(getPackNodes)),
  [],
  {
    immediate: true
  }
)

const totalNodesCount = computed(() =>
  allNodeDefs.value.reduce(
    (total, nodeDefs) => total + (nodeDefs?.length || 0),
    0
  )
)

onUnmounted(() => {
  getNodeDefs.cancel()
})
</script>
