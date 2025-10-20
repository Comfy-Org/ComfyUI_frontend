<template>
  <div v-if="nodePacks?.length" class="flex h-full flex-col">
    <div class="flex-1 overflow-auto p-6">
      <InfoPanelHeader :node-packs>
        <template #thumbnail>
          <PackIconStacked :node-packs="nodePacks" />
        </template>
        <template #title>
          <div class="mt-5">
            <span class="mr-2 inline-block text-base text-blue-500">{{
              nodePacks.length
            }}</span>
            <span class="text-base">{{ $t('manager.packsSelected') }}</span>
          </div>
        </template>
        <template #install-button>
          <!-- Mixed: Don't show any button -->
          <div v-if="isMixed" class="text-sm text-neutral-500">
            {{ $t('manager.mixedSelectionMessage') }}
          </div>
          <!-- All installed: Show uninstall button -->
          <PackUninstallButton
            v-else-if="isAllInstalled"
            size="md"
            :node-packs="installedPacks"
          />
          <!-- None installed: Show install button -->
          <PackInstallButton
            v-else-if="isNoneInstalled"
            size="md"
            :node-packs="notInstalledPacks"
            :has-conflict="hasConflicts"
            :conflict-info="conflictInfo"
          />
        </template>
      </InfoPanelHeader>
      <div class="mb-6">
        <MetadataRow :label="$t('g.status')">
          <PackStatusMessage
            :status-type="overallStatus"
            :has-compatibility-issues="hasConflicts"
          />
        </MetadataRow>
        <MetadataRow
          :label="$t('manager.totalNodes')"
          :value="totalNodesCount"
        />
      </div>
    </div>
  </div>
  <div v-else class="mx-8 mt-4 flex-1 overflow-hidden text-sm">
    {{ $t('manager.infoPanelEmpty') }}
  </div>
</template>

<script setup lang="ts">
import { useAsyncState } from '@vueuse/core'
import { computed, onUnmounted, provide, toRef } from 'vue'

import { useComfyRegistryStore } from '@/stores/comfyRegistryStore'
import type { components } from '@/types/comfyRegistryTypes'
import PackStatusMessage from '@/workbench/extensions/manager/components/manager/PackStatusMessage.vue'
import PackInstallButton from '@/workbench/extensions/manager/components/manager/button/PackInstallButton.vue'
import PackUninstallButton from '@/workbench/extensions/manager/components/manager/button/PackUninstallButton.vue'
import InfoPanelHeader from '@/workbench/extensions/manager/components/manager/infoPanel/InfoPanelHeader.vue'
import MetadataRow from '@/workbench/extensions/manager/components/manager/infoPanel/MetadataRow.vue'
import PackIconStacked from '@/workbench/extensions/manager/components/manager/packIcon/PackIconStacked.vue'
import { usePacksSelection } from '@/workbench/extensions/manager/composables/nodePack/usePacksSelection'
import { usePacksStatus } from '@/workbench/extensions/manager/composables/nodePack/usePacksStatus'
import { useConflictDetection } from '@/workbench/extensions/manager/composables/useConflictDetection'
import type { ConflictDetail } from '@/workbench/extensions/manager/types/conflictDetectionTypes'
import { ImportFailedKey } from '@/workbench/extensions/manager/types/importFailedTypes'

const { nodePacks } = defineProps<{
  nodePacks: components['schemas']['Node'][]
}>()

const nodePacksRef = toRef(() => nodePacks)

// Use new composables for cleaner code
const {
  installedPacks,
  notInstalledPacks,
  isAllInstalled,
  isNoneInstalled,
  isMixed
} = usePacksSelection(nodePacksRef)

const { hasImportFailed, overallStatus } = usePacksStatus(nodePacksRef)

const { checkNodeCompatibility } = useConflictDetection()
const { getNodeDefs } = useComfyRegistryStore()

// Provide import failed context for PackStatusMessage
provide(ImportFailedKey, {
  importFailed: hasImportFailed,
  showImportFailedDialog: () => {} // No-op for multi-selection
})

// Check for conflicts in not-installed packages - keep original logic but simplified
const packageConflicts = computed(() => {
  const conflictsByPackage = new Map<string, ConflictDetail[]>()

  for (const pack of notInstalledPacks.value) {
    const compatibilityCheck = checkNodeCompatibility(pack)
    if (compatibilityCheck.hasConflict && pack.id) {
      conflictsByPackage.set(pack.id, compatibilityCheck.conflicts)
    }
  }

  return conflictsByPackage
})

// Aggregate all unique conflicts for display
const conflictInfo = computed<ConflictDetail[]>(() => {
  const conflictMap = new Map<string, ConflictDetail>()

  packageConflicts.value.forEach((conflicts) => {
    conflicts.forEach((conflict) => {
      const key = `${conflict.type}-${conflict.current_value}-${conflict.required_value}`
      if (!conflictMap.has(key)) {
        conflictMap.set(key, conflict)
      }
    })
  })

  return Array.from(conflictMap.values())
})

const hasConflicts = computed(() => conflictInfo.value.length > 0)

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
