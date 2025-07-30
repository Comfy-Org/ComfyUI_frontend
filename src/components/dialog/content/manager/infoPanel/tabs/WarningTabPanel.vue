<template>
  <div class="flex flex-col gap-3">
    <button
      v-if="importFailedInfo"
      class="cursor-pointer outline-none border-none inline-flex items-center justify-end bg-transparent gap-1"
      @click="showImportFailedDialog"
    >
      <i class="pi pi-code text-base"></i>
      <span class="text-white text-sm">{{ t('serverStart.openLogs') }}</span>
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
import { useI18n } from 'vue-i18n'

import { useDialogService } from '@/services/dialogService'
import type { ConflictDetectionResult } from '@/types/conflictDetectionTypes'
import { getConflictMessage } from '@/utils/conflictMessageUtil'

const { conflictResult } = defineProps<{
  conflictResult?: ConflictDetectionResult | null
}>()

const { t } = useI18n()
const { showErrorDialog } = useDialogService()

const importFailedInfo = computed(() => {
  if (!conflictResult?.conflicts) return null

  const importFailedConflicts = conflictResult.conflicts.filter(
    (item) => item.type === 'import_failed'
  )

  return importFailedConflicts.length > 0 ? importFailedConflicts : null
})

const showImportFailedDialog = () => {
  if (importFailedInfo.value) {
    const errorMessage =
      importFailedInfo.value
        .map((conflict) => conflict.required_value)
        .filter(Boolean)
        .join('\n') || t('manager.importFailedGenericError')

    const error = new Error(errorMessage)

    showErrorDialog(error, {
      title: t('manager.failedToInstall'),
      reportType: 'importFailedError'
    })
  }
}
</script>
