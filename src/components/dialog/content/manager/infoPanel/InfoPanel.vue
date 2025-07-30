<template>
  <template v-if="nodePack">
    <div class="flex flex-col h-full z-40 overflow-hidden relative">
      <div class="top-0 z-10 px-6 pt-6 w-full">
        <InfoPanelHeader
          :node-packs="[nodePack]"
          :has-conflict="hasCompatibilityIssues"
        />
      </div>
      <div
        ref="scrollContainer"
        class="p-6 pt-2 overflow-y-auto flex-1 text-sm scrollbar-hide"
      >
        <div class="mb-6">
          <MetadataRow
            v-if="isPackInstalled(nodePack.id)"
            :label="t('manager.filter.enabled')"
            class="flex"
            style="align-items: center"
          >
            <PackEnableToggle
              :node-pack="nodePack"
              :has-conflict="hasCompatibilityIssues"
            />
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
              :has-compatibility-issues="hasCompatibilityIssues"
            />
          </MetadataRow>
          <MetadataRow :label="t('manager.version')">
            <PackVersionBadge :node-pack="nodePack" :is-selected="true" />
          </MetadataRow>
        </div>
        <div class="mb-6 overflow-hidden">
          <InfoTabs
            :node-pack="nodePack"
            :has-compatibility-issues="hasCompatibilityIssues"
            :conflict-result="conflictResult"
          />
        </div>
      </div>
    </div>
  </template>
  <template v-else>
    <div class="pt-4 px-8 flex-1 overflow-hidden text-sm">
      {{ $t('manager.infoPanelEmpty') }}
    </div>
  </template>
</template>

<script setup lang="ts">
import { useScroll, whenever } from '@vueuse/core'
import { computed, provide, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import PackStatusMessage from '@/components/dialog/content/manager/PackStatusMessage.vue'
import PackVersionBadge from '@/components/dialog/content/manager/PackVersionBadge.vue'
import PackEnableToggle from '@/components/dialog/content/manager/button/PackEnableToggle.vue'
import InfoPanelHeader from '@/components/dialog/content/manager/infoPanel/InfoPanelHeader.vue'
import InfoTabs from '@/components/dialog/content/manager/infoPanel/InfoTabs.vue'
import MetadataRow from '@/components/dialog/content/manager/infoPanel/MetadataRow.vue'
import { useConflictDetection } from '@/composables/useConflictDetection'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import { useConflictDetectionStore } from '@/stores/conflictDetectionStore'
import { IsInstallingKey } from '@/types/comfyManagerTypes'
import { components } from '@/types/comfyRegistryTypes'
import type { ConflictDetectionResult } from '@/types/conflictDetectionTypes'

interface InfoItem {
  key: string
  label: string
  value: string | number | undefined
}

const { nodePack } = defineProps<{
  nodePack: components['schemas']['Node']
}>()

const scrollContainer = ref<HTMLElement | null>(null)

const { isPackInstalled } = useComfyManagerStore()
const isInstalled = computed(() => isPackInstalled(nodePack.id))
const isInstalling = ref(false)
provide(IsInstallingKey, isInstalling)
whenever(isInstalled, () => {
  isInstalling.value = false
})

const { checkNodeCompatibility } = useConflictDetection()
const { getConflictsForPackageByID } = useConflictDetectionStore()

const { t, d, n } = useI18n()

// Check compatibility once and pass to children
const conflictResult = computed((): ConflictDetectionResult | null => {
  // For installed packages, use stored conflict data
  if (isInstalled.value && nodePack.id) {
    return getConflictsForPackageByID(nodePack.id) || null
  }

  // For non-installed packages, perform compatibility check
  const compatibility = checkNodeCompatibility(nodePack)

  if (compatibility.hasConflict) {
    return {
      package_id: nodePack.id || '',
      package_name: nodePack.name || '',
      has_conflict: true,
      conflicts: compatibility.conflicts,
      is_compatible: false
    }
  }

  return null
})

const hasCompatibilityIssues = computed(() => {
  return conflictResult.value?.has_conflict
})

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

const { y } = useScroll(scrollContainer, {
  eventListenerOptions: {
    passive: true
  }
})
const onNodePackChange = () => {
  y.value = 0
}

whenever(
  () => nodePack.id,
  (nodePackId, oldNodePackId) => {
    if (nodePackId !== oldNodePackId) {
      onNodePackChange()
    }
  },
  { immediate: true }
)
</script>
