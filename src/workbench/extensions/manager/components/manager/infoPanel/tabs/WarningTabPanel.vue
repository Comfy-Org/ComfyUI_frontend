<template>
  <div class="flex flex-col gap-3">
    <button
      v-if="importFailedInfo"
      class="inline-flex cursor-pointer items-center justify-end gap-1 border-none bg-transparent outline-none"
      @click="showImportFailedDialog"
    >
      <i class="pi pi-code text-base"></i>
      <span class="text-sm text-base-foreground">{{
        t('serverStart.openLogs')
      }}</span>
    </button>
    <div
      v-for="(conflict, index) in conflictResult?.conflicts || []"
      :key="index"
      class="rounded-md bg-yellow-800/20 p-3"
    >
      <div class="flex items-center justify-between">
        <div class="flex-1 text-sm break-words">
          {{ getConflictMessage(conflict, $t) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { t } from '@/i18n'
import type { components } from '@/types/comfyRegistryTypes'
import { useImportFailedDetection } from '@/workbench/extensions/manager/composables/useImportFailedDetection'
import type { ConflictDetectionResult } from '@/workbench/extensions/manager/types/conflictDetectionTypes'
import { getConflictMessage } from '@/workbench/extensions/manager/utils/conflictMessageUtil'

const { nodePack, conflictResult } = defineProps<{
  nodePack: components['schemas']['Node']
  conflictResult: ConflictDetectionResult | null | undefined
}>()
const packageId = computed(() => nodePack?.id || '')
const { importFailedInfo, showImportFailedDialog } =
  useImportFailedDetection(packageId)
</script>
