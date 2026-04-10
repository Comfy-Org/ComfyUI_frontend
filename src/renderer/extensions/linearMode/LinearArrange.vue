<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'

import Button from '@/components/ui/button/Button.vue'
import { useAppMode } from '@/composables/useAppMode'
import { parseNodeOutput } from '@/stores/resultItemParsing'
import MediaOutputPreview from '@/renderer/extensions/linearMode/MediaOutputPreview.vue'
import { useAppModeStore } from '@/stores/appModeStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
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
    const results = parseNodeOutput(nodeId, nodeOutput)
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
    class="mx-auto flex h-full w-3/4 flex-col items-center justify-center gap-6 p-8"
  >
    <div
      class="flex h-4/5 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-warning-background p-12"
    >
      <p class="mb-0 font-bold text-base-foreground">
        {{ t('linearMode.arrange.outputs') }}
      </p>
      <p class="text-center">{{ t('linearMode.arrange.resultsLabel') }}</p>
    </div>
  </div>
  <div
    v-else
    role="article"
    data-testid="arrange-no-outputs"
    class="mx-auto flex h-full w-lg flex-col items-center justify-center gap-6 p-8 text-center"
  >
    <p class="m-0 text-base-foreground">
      {{ t('linearMode.arrange.noOutputs') }}
    </p>

    <div class="flex w-lg flex-col gap-1 text-[14px] text-muted-foreground">
      <p class="mt-0 p-0">{{ t('linearMode.arrange.switchToOutputs') }}</p>

      <i18n-t keypath="linearMode.arrange.connectAtLeastOne" tag="div">
        <template #atLeastOne>
          <span class="font-bold italic">
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
