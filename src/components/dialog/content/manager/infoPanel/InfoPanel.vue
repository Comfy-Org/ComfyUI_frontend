<template>
  <div class="flex flex-col h-full z-40 hidden-scrollbar w-80">
    <div class="p-6 flex-1 overflow-hidden text-sm">
      <PackCardHeader
        :node-pack="nodePack"
        :install-button-full-width="false"
      />
      <div class="mb-6">
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
          <PackVersionBadge
            :node-pack="nodePack"
            :version="selectedVersion"
            @update:version="updateSelectedVersion"
          />
        </MetadataRow>
      </div>
      <div class="mb-6 overflow-hidden">
        <InfoTabs :node-pack="nodePack" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import PackStatusMessage from '@/components/dialog/content/manager/PackStatusMessage.vue'
import PackVersionBadge from '@/components/dialog/content/manager/PackVersionBadge.vue'
import InfoTabs from '@/components/dialog/content/manager/infoPanel/InfoTabs.vue'
import MetadataRow from '@/components/dialog/content/manager/infoPanel/MetadataRow.vue'
import PackCardHeader from '@/components/dialog/content/manager/packCard/PackCardHeader.vue'
import { SelectedVersion } from '@/types/comfyManagerTypes'
import { components } from '@/types/comfyRegistryTypes'
import { formatNumber } from '@/utils/formatUtil'

interface InfoItem {
  key: string
  label: string
  value: string | number | undefined
}

const { nodePack } = defineProps<{
  nodePack: components['schemas']['Node']
}>()

const { t, d } = useI18n()

const packCardHeaderRef = ref(null)

const selectedVersion = ref<string>(
  nodePack.latest_version?.version || SelectedVersion.NIGHTLY
)
const updateSelectedVersion = (version: string) => {
  selectedVersion.value = version
  if (packCardHeaderRef.value) {
    packCardHeaderRef.value.updateVersion?.(version)
  }
}

const infoItems = computed<InfoItem[]>(() => [
  {
    key: 'publisher',
    label: t('manager.createdBy'),
    // TODO: handle all Comfy Registry publisher types dynamically (e.g., organizations, multiple authors)
    value: nodePack.publisher?.name
  },
  {
    key: 'downloads',
    label: t('manager.downloads'),
    value: nodePack.downloads ? formatNumber(nodePack.downloads) : undefined
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
