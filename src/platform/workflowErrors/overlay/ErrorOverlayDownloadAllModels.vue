<template>
  <Button
    v-if="downloadableModels.length > 0 && !hasGatedModel"
    variant="secondary"
    size="sm"
    class="min-w-0"
    data-testid="error-overlay-download-all-models"
    :disabled="!isEveryLookupResolved"
    @click="downloadAll"
  >
    <i aria-hidden="true" class="icon-[lucide--download]" />
    <span class="truncate">{{ downloadAllLabel }}</span>
  </Button>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import { useDownloadAllMissingModels } from '@/platform/workflowErrors/missingModel/composables/useDownloadAllMissingModels'
import { fetchModelMetadataWithStatus } from '@/platform/workflowErrors/missingModel/missingModelDownload'
import type { ModelMetadataFetchOutcome } from '@/platform/workflowErrors/missingModel/missingModelDownload'
import type { MissingModelGroup } from '@/platform/workflowErrors/missingModel/types'

const { missingModelGroups } = defineProps<{
  missingModelGroups: MissingModelGroup[]
}>()

const emit = defineEmits<{ downloaded: [] }>()

const { downloadableModels, downloadAllLabel, downloadAllModels } =
  useDownloadAllMissingModels(() => missingModelGroups)

const lookups = ref<Record<string, ModelMetadataFetchOutcome>>({})
const urls = computed(() => downloadableModels.value.map((model) => model.url))

watch(
  urls,
  (current) => {
    for (const url of current) {
      if (lookups.value[url]) continue
      void fetchModelMetadataWithStatus(url).then((outcome) => {
        lookups.value[url] = outcome
      })
    }
  },
  { immediate: true }
)

const isEveryLookupResolved = computed(() =>
  urls.value.every((url) => lookups.value[url]?.resolution === 'resolved')
)

const hasGatedModel = computed(() =>
  urls.value.some((url) => !!lookups.value[url]?.metadata.gatedRepoUrl)
)

function downloadAll() {
  downloadAllModels()
  emit('downloaded')
}
</script>
