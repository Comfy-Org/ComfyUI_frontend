<template>
  <div class="flex flex-col h-full">
    <div class="p-6 flex-1 overflow-auto">
      <InfoPanelHeader :node-packs="nodePacks">
        <template #thumbnail>
          <PackIconStacked :node-packs="nodePacks" />
        </template>
        <template #title>
          {{ nodePacks.length }}
          {{ $t('manager.packsSelected') }}
        </template>
        <template #install-button>
          <PackInstallButton :full-width="true" :node-packs="nodePacks" />
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
</template>

<script setup lang="ts">
import { useAsyncState } from '@vueuse/core'
import { computed } from 'vue'

import PackStatusMessage from '@/components/dialog/content/manager/PackStatusMessage.vue'
import PackInstallButton from '@/components/dialog/content/manager/button/PackInstallButton.vue'
import InfoPanelHeader from '@/components/dialog/content/manager/infoPanel/InfoPanelHeader.vue'
import MetadataRow from '@/components/dialog/content/manager/infoPanel/MetadataRow.vue'
import PackIconStacked from '@/components/dialog/content/manager/packIcon/PackIconStacked.vue'
import { useComfyRegistryService } from '@/services/comfyRegistryService'
import { components } from '@/types/comfyRegistryTypes'

const { nodePacks } = defineProps<{
  nodePacks: components['schemas']['Node'][]
}>()

const comfyRegistryService = useComfyRegistryService()

const getPackNodes = async (pack: components['schemas']['Node']) => {
  if (!comfyRegistryService.packNodesAvailable(pack)) return []
  return comfyRegistryService.getNodeDefs({
    packId: pack.id,
    versionId: pack.latest_version?.id
  })
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
</script>
