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
import { computed, onUnmounted, provide } from 'vue'

import PackStatusMessage from '@/components/dialog/content/manager/PackStatusMessage.vue'
import PackInstallButton from '@/components/dialog/content/manager/button/PackInstallButton.vue'
import PackUninstallButton from '@/components/dialog/content/manager/button/PackUninstallButton.vue'
import InfoPanelHeader from '@/components/dialog/content/manager/infoPanel/InfoPanelHeader.vue'
import MetadataRow from '@/components/dialog/content/manager/infoPanel/MetadataRow.vue'
import PackIconStacked from '@/components/dialog/content/manager/packIcon/PackIconStacked.vue'
import { useConflictDetection } from '@/composables/useConflictDetection'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import { useComfyRegistryStore } from '@/stores/comfyRegistryStore'
import { useConflictDetectionStore } from '@/stores/conflictDetectionStore'
import { components } from '@/types/comfyRegistryTypes'
import type { ConflictDetail } from '@/types/conflictDetectionTypes'
import { ImportFailedKey } from '@/types/importFailedTypes'

const { nodePacks } = defineProps<{
  nodePacks: components['schemas']['Node'][]
}>()

const managerStore = useComfyManagerStore()
const conflictDetectionStore = useConflictDetectionStore()
const { checkNodeCompatibility } = useConflictDetection()

const { getNodeDefs } = useComfyRegistryStore()

// Check if any package has import failed status
const hasImportFailed = computed(() => {
  return nodePacks.some((pack) => {
    if (!pack.id) return false
    const conflicts = conflictDetectionStore.getConflictsForPackageByID(pack.id)
    return (
      conflicts?.conflicts?.some((c) => c.type === 'import_failed') || false
    )
  })
})

// Provide import failed context for PackStatusMessage
provide(ImportFailedKey, {
  importFailed: hasImportFailed,
  showImportFailedDialog: () => {} // No-op for multi-selection
})

// Check installation status
const installedPacks = computed(() =>
  nodePacks.filter((pack) => managerStore.isPackInstalled(pack.id))
)

const notInstalledPacks = computed(() =>
  nodePacks.filter((pack) => !managerStore.isPackInstalled(pack.id))
)

const isAllInstalled = computed(
  () => installedPacks.value.length === nodePacks.length
)

const isNoneInstalled = computed(
  () => notInstalledPacks.value.length === nodePacks.length
)

const isMixed = computed(
  () => installedPacks.value.length > 0 && notInstalledPacks.value.length > 0
)

// Check for conflicts in not-installed packages - store per package
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

// Determine the most important status from all selected packages
const overallStatus = computed(() => {
  // Check for import failed first (highest priority for installed packages)
  if (hasImportFailed.value) {
    // Import failed doesn't have a specific status enum, so we return active
    // but the PackStatusMessage will handle it via hasImportFailed prop
    return 'NodeVersionStatusActive' as components['schemas']['NodeVersionStatus']
  }

  // Priority order: banned > deleted > flagged > pending > active
  const statusPriority = [
    'NodeStatusBanned',
    'NodeVersionStatusBanned',
    'NodeStatusDeleted',
    'NodeVersionStatusDeleted',
    'NodeVersionStatusFlagged',
    'NodeVersionStatusPending',
    'NodeStatusActive',
    'NodeVersionStatusActive'
  ]

  for (const priorityStatus of statusPriority) {
    if (nodePacks.some((pack) => pack.status === priorityStatus)) {
      return priorityStatus as
        | components['schemas']['NodeStatus']
        | components['schemas']['NodeVersionStatus']
    }
  }

  // Default to active if no specific status found
  return 'NodeVersionStatusActive' as components['schemas']['NodeVersionStatus']
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
