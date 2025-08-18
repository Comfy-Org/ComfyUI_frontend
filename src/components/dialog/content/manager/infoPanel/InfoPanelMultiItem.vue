<template>
  <div v-if="nodePacks?.length" class="flex flex-col h-full">
    <div class="p-6 flex-1 overflow-auto">
      <InfoPanelHeader :node-packs>
        <template #thumbnail>
          <PackIconStacked :node-packs="nodePacks" />
        </template>
        <template #title>
          <div class="mt-5">
            <span class="inline-block mr-2 text-blue-500 text-base">{{
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
  <div v-else class="mt-4 mx-8 flex-1 overflow-hidden text-sm">
    {{ $t('manager.infoPanelEmpty') }}
  </div>
</template>

<script setup lang="ts">
import { useAsyncState } from '@vueuse/core'
import { computed, onUnmounted, provide, toRef } from 'vue'

import PackStatusMessage from '@/components/dialog/content/manager/PackStatusMessage.vue'
import PackInstallButton from '@/components/dialog/content/manager/button/PackInstallButton.vue'
import PackUninstallButton from '@/components/dialog/content/manager/button/PackUninstallButton.vue'
import InfoPanelHeader from '@/components/dialog/content/manager/infoPanel/InfoPanelHeader.vue'
import MetadataRow from '@/components/dialog/content/manager/infoPanel/MetadataRow.vue'
import PackIconStacked from '@/components/dialog/content/manager/packIcon/PackIconStacked.vue'
import { useConflictDetection } from '@/composables/useConflictDetection'
import { usePackageSelection } from '@/composables/usePackageSelection'
import { usePackageStatus } from '@/composables/usePackageStatus'
import { useComfyRegistryStore } from '@/stores/comfyRegistryStore'
import { components } from '@/types/comfyRegistryTypes'
import type { ConflictDetail } from '@/types/conflictDetectionTypes'
import { ImportFailedKey } from '@/types/importFailedTypes'

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
} = usePackageSelection(nodePacksRef)

const { hasImportFailed, overallStatus } = usePackageStatus(nodePacksRef)

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
