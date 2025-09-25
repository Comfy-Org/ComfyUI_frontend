<template>
  <div class="flex flex-col gap-3">
    <button
      v-if="importFailedInfo"
      class="cursor-pointer outline-none border-none inline-flex items-center justify-end bg-transparent gap-1"
      @click="showImportFailedDialog"
    >
      <i class="pi pi-code text-base"></i>
      <span class="dark-theme:text-white text-sm">{{
        t('serverStart.openLogs')
      }}</span>
    </button>
    <div
      v-for="(conflict, index) in conflictResult?.conflicts || []"
      :key="index"
      class="p-3 bg-yellow-800/20 rounded-md"
    >
      <div class="flex justify-between items-center">
        <div class="text-sm break-words flex-1">
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
import type { ConflictDetectionResult } from '@/types/conflictDetectionTypes'
import { getConflictMessage } from '@/utils/conflictMessageUtil'
import { useImportFailedDetection } from '@/workbench/extensions/manager/composables/useImportFailedDetection'

const { nodePack, conflictResult } = defineProps<{
  nodePack: components['schemas']['Node']
  conflictResult: ConflictDetectionResult | null | undefined
}>()
const packageId = computed(() => nodePack?.id || '')
const { importFailedInfo, showImportFailedDialog } =
  useImportFailedDetection(packageId)
</script>
