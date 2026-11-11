<template>
  <Button
    v-if="downloadableModels.length > 0 && isEveryModelVerifiedUngated"
    variant="secondary"
    size="sm"
    class="min-w-0"
    data-testid="error-overlay-download-all-models"
    @click="downloadAll"
  >
    <i aria-hidden="true" class="icon-[lucide--download]" />
    <span class="truncate">{{ downloadAllLabel }}</span>
  </Button>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import { useDownloadAllMissingModels } from '@/platform/workflowErrors/missingModel/composables/useDownloadAllMissingModels'
import type { MissingModelGroup } from '@/platform/workflowErrors/missingModel/types'

const { missingModelGroups } = defineProps<{
  missingModelGroups: MissingModelGroup[]
}>()

const emit = defineEmits<{ downloaded: [] }>()

const {
  downloadableModels,
  isEveryModelVerifiedUngated,
  downloadAllLabel,
  downloadAllModels
} = useDownloadAllMissingModels(() => missingModelGroups)

function downloadAll() {
  downloadAllModels()
  emit('downloaded')
}
</script>
