<template>
  <div v-if="nodePacks?.length" class="flex flex-col items-center">
    <slot name="thumbnail">
      <PackIcon :node-pack="nodePacks[0]" width="204" height="106" />
    </slot>
    <h2
      class="mt-4 mb-2 text-center text-2xl font-bold"
      style="word-break: break-all"
    >
      <slot name="title">
        <span class="inline-block text-base">{{ nodePacks[0].name }}</span>
      </slot>
    </h2>
    <div
      v-if="!importFailed"
      class="mt-2 mb-4 flex w-full max-w-xs justify-center"
    >
      <slot name="install-button">
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
          :node-packs="nodePacks"
          :has-conflict="hasConflict || computedHasConflict"
          :conflict-info="conflictInfo"
        />
      </slot>
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
import PackUninstallButton from '@/workbench/extensions/manager/components/manager/button/PackUninstallButton.vue'
import PackIcon from '@/workbench/extensions/manager/components/manager/packIcon/PackIcon.vue'
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
