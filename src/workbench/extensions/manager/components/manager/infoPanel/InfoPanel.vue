<template>
  <template v-if="nodePack">
    <div class="relative z-40 flex h-full flex-col overflow-hidden">
      <div class="top-0 z-10 w-full px-6 pt-6">
        <InfoPanelHeader
          :node-packs="[nodePack]"
          :has-conflict="hasCompatibilityIssues"
        />
      </div>
      <div
        ref="scrollContainer"
        class="scrollbar-hide flex-1 overflow-y-auto p-6 pt-2 text-sm"
      >
        <div class="mb-6">
          <MetadataRow
            v-if="!importFailed && isPackInstalled(nodePack.id)"
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
    <div class="flex-1 overflow-hidden px-8 pt-4 text-sm">
      {{ $t('manager.infoPanelEmpty') }}
    </div>
  </template>
</template>

<script setup lang="ts">
import { useScroll, whenever } from '@vueuse/core'
import { computed, provide, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { components } from '@/types/comfyRegistryTypes'
import PackStatusMessage from '@/workbench/extensions/manager/components/manager/PackStatusMessage.vue'
import PackVersionBadge from '@/workbench/extensions/manager/components/manager/PackVersionBadge.vue'
import PackEnableToggle from '@/workbench/extensions/manager/components/manager/button/PackEnableToggle.vue'
import InfoPanelHeader from '@/workbench/extensions/manager/components/manager/infoPanel/InfoPanelHeader.vue'
import InfoTabs from '@/workbench/extensions/manager/components/manager/infoPanel/InfoTabs.vue'
import MetadataRow from '@/workbench/extensions/manager/components/manager/infoPanel/MetadataRow.vue'
import { useConflictDetection } from '@/workbench/extensions/manager/composables/useConflictDetection'
import { useImportFailedDetection } from '@/workbench/extensions/manager/composables/useImportFailedDetection'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'
import { useConflictDetectionStore } from '@/workbench/extensions/manager/stores/conflictDetectionStore'
import { IsInstallingKey } from '@/workbench/extensions/manager/types/comfyManagerTypes'
import type { ConflictDetectionResult } from '@/workbench/extensions/manager/types/conflictDetectionTypes'
import { ImportFailedKey } from '@/workbench/extensions/manager/types/importFailedTypes'

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

const packageId = computed(() => nodePack.id || '')
const { importFailed, showImportFailedDialog } =
  useImportFailedDetection(packageId)

provide(ImportFailedKey, {
  importFailed,
  showImportFailedDialog
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
