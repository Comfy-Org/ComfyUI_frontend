<template>
  <div
    class="min-h-12 flex justify-between items-center px-4 py-2 text-xs text-muted font-medium leading-3"
  >
    <div v-if="nodePack.downloads" class="flex items-center gap-1.5">
      <i class="pi pi-download text-muted"></i>
      <span>{{ formattedDownloads }}</span>
    </div>
    <PackInstallButton
      v-if="!isInstalled"
      :node-packs="[nodePack]"
      :is-installing="isInstalling"
      :has-conflict="hasConflicts"
      :conflict-info="conflictInfo"
    />
    <PackEnableToggle
      v-else
      :has-conflict="hasConflicts"
      :node-pack="nodePack"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'

import { useConflictDetection } from '@/composables/useConflictDetection'
import type { components } from '@/types/comfyRegistryTypes'
import type { ConflictDetail } from '@/types/conflictDetectionTypes'
import PackEnableToggle from '@/workbench/extensions/manager/components/manager/button/PackEnableToggle.vue'
import PackInstallButton from '@/workbench/extensions/manager/components/manager/button/PackInstallButton.vue'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'
import { IsInstallingKey } from '@/workbench/extensions/manager/types/comfyManagerTypes'

const { nodePack } = defineProps<{
  nodePack: components['schemas']['Node']
}>()

const { isPackInstalled } = useComfyManagerStore()
const isInstalled = computed(() => isPackInstalled(nodePack?.id))
const isInstalling = inject(IsInstallingKey)

const { n } = useI18n()

const formattedDownloads = computed(() =>
  nodePack.downloads ? n(nodePack.downloads) : ''
)

// Add conflict detection for the card button
const { checkNodeCompatibility } = useConflictDetection()

// Check for conflicts with this specific node pack
const conflictInfo = computed<ConflictDetail[]>(() => {
  if (!nodePack) return []
  const compatibilityCheck = checkNodeCompatibility(nodePack)
  return compatibilityCheck.conflicts || []
})

const hasConflicts = computed(() => conflictInfo.value.length > 0)
</script>
