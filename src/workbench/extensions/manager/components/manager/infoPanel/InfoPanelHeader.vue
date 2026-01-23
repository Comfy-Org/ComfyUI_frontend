<template>
  <div v-if="nodePacks?.length" class="flex flex-col items-center">
    <p class="text-center text-base font-bold">{{ nodePacks[0].name }}</p>
    <div v-if="!importFailed" class="flex justify-center gap-2">
      <template v-if="canTryNightlyUpdate">
        <PackTryUpdateButton :node-pack="nodePacks[0]" size="md" />
        <PackUninstallButton :node-packs="nodePacks" size="md" />
      </template>
      <template v-else-if="isAllInstalled">
        <PackUninstallButton
          v-bind="$attrs"
          size="md"
          :node-packs="nodePacks"
        />
      </template>
      <template v-else>
        <PackInstallButton
          v-bind="$attrs"
          size="md"
          :node-packs="nodePacks"
          :has-conflict="hasConflict || computedHasConflict"
          :conflict-info="conflictInfo"
        />
      </template>
    </div>
  </div>
  <div v-else class="flex flex-col items-center">
    <NoResultsPlaceholder
      :message="$t('manager.status.unknown')"
      :title="$t('manager.tryAgainLater')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'

import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import type { components } from '@/types/comfyRegistryTypes'
import PackInstallButton from '@/workbench/extensions/manager/components/manager/button/PackInstallButton.vue'
import PackTryUpdateButton from '@/workbench/extensions/manager/components/manager/button/PackTryUpdateButton.vue'
import PackUninstallButton from '@/workbench/extensions/manager/components/manager/button/PackUninstallButton.vue'
import { usePackUpdateStatus } from '@/workbench/extensions/manager/composables/nodePack/usePackUpdateStatus'
import { useConflictDetection } from '@/workbench/extensions/manager/composables/useConflictDetection'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'
import type { ConflictDetail } from '@/workbench/extensions/manager/types/conflictDetectionTypes'
import { ImportFailedKey } from '@/workbench/extensions/manager/types/importFailedTypes'

const { nodePacks, hasConflict } = defineProps<{
  nodePacks: components['schemas']['Node'][]
  hasConflict?: boolean
}>()

const managerStore = useComfyManagerStore()

// Inject import failed context from parent
const importFailedContext = inject(ImportFailedKey)
const importFailed = importFailedContext?.importFailed

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

// Check if nightly update is available for the first pack
const { canTryNightlyUpdate } = usePackUpdateStatus(() => nodePacks[0])

// Add conflict detection for install button dialog
const { checkNodeCompatibility } = useConflictDetection()

// Compute conflict info for all node packs
const conflictInfo = computed<ConflictDetail[]>(() => {
  if (!nodePacks?.length) return []

  const allConflicts: ConflictDetail[] = []
  for (const nodePack of nodePacks) {
    const compatibilityCheck = checkNodeCompatibility(nodePack)
    if (compatibilityCheck.conflicts) {
      allConflicts.push(...compatibilityCheck.conflicts)
    }
  }
  return allConflicts
})

const computedHasConflict = computed(() => conflictInfo.value.length > 0)
</script>
