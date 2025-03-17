<template>
  <template v-if="nodePack">
    <div class="flex flex-col h-full z-40 hidden-scrollbar w-80">
      <div class="p-6 flex-1 overflow-hidden text-sm">
        <InfoPanelHeader :node-packs="[nodePack]" />
        <div class="mb-6">
          <MetadataRow
            v-if="isPackInstalled(nodePack.id)"
            :label="t('manager.filter.enabled')"
            class="flex"
            style="align-items: center"
          >
            <PackEnableToggle :node-pack="nodePack" />
          </MetadataRow>
          <MetadataRow
            v-for="item in infoItems"
            v-show="item.value !== undefined && item.value !== null"
            :key="item.key"
            :label="item.label"
            :value="item.value"
          />
          <MetadataRow :label="t('g.status')">
            <PackStatusMessage
              :status-type="
                nodePack.status as components['schemas']['NodeVersionStatus']
              "
            />
          </MetadataRow>
          <MetadataRow :label="t('manager.version')">
            <PackVersionBadge :node-pack="nodePack" />
          </MetadataRow>
        </div>
        <div class="mb-6 overflow-hidden">
          <InfoTabs :node-pack="nodePack" />
        </div>
      </div>
    </div>
  </template>
  <template v-else>
    <div class="mt-4 mx-8 flex-1 overflow-hidden text-sm">
      {{ $t('manager.infoPanelEmpty') }}
    </div>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import PackStatusMessage from '@/components/dialog/content/manager/PackStatusMessage.vue'
import PackVersionBadge from '@/components/dialog/content/manager/PackVersionBadge.vue'
import PackEnableToggle from '@/components/dialog/content/manager/button/PackEnableToggle.vue'
import InfoPanelHeader from '@/components/dialog/content/manager/infoPanel/InfoPanelHeader.vue'
import InfoTabs from '@/components/dialog/content/manager/infoPanel/InfoTabs.vue'
import MetadataRow from '@/components/dialog/content/manager/infoPanel/MetadataRow.vue'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import { components } from '@/types/comfyRegistryTypes'

interface InfoItem {
  key: string
  label: string
  value: string | number | undefined
}

const { nodePack } = defineProps<{
  nodePack: components['schemas']['Node']
}>()

const { isPackInstalled } = useComfyManagerStore()

const { t, d, n } = useI18n()

const infoItems = computed<InfoItem[]>(() => [
  {
    key: 'publisher',
    label: t('manager.createdBy'),
    value: nodePack.publisher?.name ?? nodePack.publisher?.id
  },
  {
    key: 'downloads',
    label: t('manager.downloads'),
    value: nodePack.downloads ? n(nodePack.downloads) : undefined
  },
  {
    key: 'lastUpdated',
    label: t('manager.lastUpdated'),
    value: nodePack.latest_version?.createdAt
      ? d(nodePack.latest_version.createdAt, {
          dateStyle: 'medium'
        })
      : undefined
  }
])
</script>
<style scoped>
.hidden-scrollbar {
  height: 100%;
  overflow-y: auto;

  /* Firefox */
  scrollbar-width: none;

  &::-webkit-scrollbar {
    width: 1px;
  }

  &::-webkit-scrollbar-thumb {
    background-color: transparent;
  }
}
</style>
