<template>
  <Button
    v-if="downloadableModels.length > 0 && gatedModelCount === 0"
    variant="secondary"
    size="sm"
    class="min-w-0"
    data-testid="error-overlay-download-all-models"
    @click="downloadAll"
  >
    <i aria-hidden="true" class="icon-[lucide--download]" />
    <span class="truncate">{{
      t('rightSidePanel.missingModels.downloadAll')
    }}</span>
  </Button>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import { useDownloadAllMissingModels } from '@/platform/workflowErrors/missingModel/composables/useDownloadAllMissingModels'
import type { MissingModelGroup } from '@/platform/workflowErrors/missingModel/types'

const { missingModelGroups } = defineProps<{
  missingModelGroups: MissingModelGroup[]
}>()

const emit = defineEmits<{ downloaded: [] }>()

const { t } = useI18n()
const { downloadableModels, gatedModelCount, downloadAllModels } =
  useDownloadAllMissingModels(() => missingModelGroups)

function downloadAll() {
  downloadAllModels()
  emit('downloaded')
}
</script>
