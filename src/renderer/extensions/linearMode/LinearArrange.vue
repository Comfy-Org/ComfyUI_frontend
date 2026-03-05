<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'

import Button from '@/components/ui/button/Button.vue'
import { useAppMode } from '@/composables/useAppMode'
import { flattenNodeOutput } from '@/renderer/extensions/linearMode/flattenNodeOutput'
import MediaOutputPreview from '@/renderer/extensions/linearMode/MediaOutputPreview.vue'
import { useAppModeStore } from '@/stores/appModeStore'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

const { t } = useI18n()
const { setMode } = useAppMode()
const appModeStore = useAppModeStore()
const { hasOutputs } = storeToRefs(appModeStore)
const nodeOutputStore = useNodeOutputStore()
const { nodeIdToNodeLocatorId } = useWorkflowStore()

const existingOutput = computed(() => {
  for (const nodeId of appModeStore.selectedOutputs) {
    const locatorId = nodeIdToNodeLocatorId(nodeId)
    const nodeOutput = nodeOutputStore.nodeOutputs[locatorId]
    if (!nodeOutput) continue
    const results = flattenNodeOutput([nodeId, nodeOutput])
    if (results.length > 0) return results[0]
  }
  return undefined
})
</script>

<template>
  <MediaOutputPreview
    v-if="existingOutput"
    :output="existingOutput"
    class="px-12 py-24"
  />
  <div
    v-else-if="hasOutputs"
    role="article"
    data-testid="arrange-preview"
    class="flex flex-col items-center justify-center h-full w-3/4 gap-6 p-8 mx-auto"
  >
    <div
      class="border-warning-background border-2 border-dashed rounded-2xl w-full h-4/5 flex items-center justify-center flex-col p-12"
    >
      <p class="text-base-foreground font-bold mb-0">
        {{ t('linearMode.arrange.outputs') }}
      </p>
      <p>{{ t('linearMode.arrange.resultsLabel') }}</p>
    </div>
  </div>
  <div
    v-else
    role="article"
    data-testid="arrange-no-outputs"
    class="flex flex-col items-center justify-center h-full gap-6 p-8 w-lg mx-auto text-center"
  >
    <p class="m-0 text-base-foreground">
      {{ t('linearMode.arrange.noOutputs') }}
    </p>

    <div class="flex flex-col gap-1 text-muted-foreground w-lg text-[14px]">
      <p class="mt-0 p-0">{{ t('linearMode.arrange.switchToOutputs') }}</p>

      <i18n-t keypath="linearMode.arrange.connectAtLeastOne" tag="div">
        <template #atLeastOne>
          <span class="italic font-bold">
            {{ t('linearMode.arrange.atLeastOne') }}
          </span>
        </template>
      </i18n-t>

      <p class="mt-0 p-0">{{ t('linearMode.arrange.outputExamples') }}</p>
    </div>
    <div class="flex flex-row gap-2">
      <Button variant="primary" size="lg" @click="setMode('builder:outputs')">
        {{ t('linearMode.arrange.switchToOutputsButton') }}
      </Button>
    </div>
  </div>
</template>
