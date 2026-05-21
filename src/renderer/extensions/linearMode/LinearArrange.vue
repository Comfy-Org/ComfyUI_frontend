<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import PreviewCard from '@/components/appMode/layout/PreviewCard.vue'
import Button from '@/components/ui/button/Button.vue'
import { useAppMode } from '@/composables/useAppMode'
import DragReorderDemo from '@/renderer/extensions/linearMode/DragReorderDemo.vue'
import { flattenNodeOutput } from '@/renderer/extensions/linearMode/flattenNodeOutput'
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
    data-testid="linear-arrange-preview"
    class="mx-auto flex size-full flex-col items-center justify-center gap-4 p-8"
    style="transform: translateX(calc(-0.5 * var(--sidebar-width, 0px)))"
  >
    <PreviewCard :title="t('linearMode.arrange.outputs')" class="w-132">
      <p
        class="m-0 max-w-prose px-6 py-8 text-left text-lg text-base-foreground"
      >
        {{ t('linearMode.arrange.resultsLabel') }}
      </p>
    </PreviewCard>

    <PreviewCard :title="t('linearMode.arrange.inputs')" class="w-132">
      <div class="flex flex-col items-stretch gap-4 p-6">
        <p class="m-0 max-w-prose text-left text-lg text-base-foreground">
          {{ t('linearMode.arrange.dragHint') }}
        </p>
        <DragReorderDemo />
      </div>
    </PreviewCard>
  </div>
  <div
    v-else
    role="article"
    data-testid="linear-arrange-no-outputs"
    class="mx-auto flex h-full w-lg flex-col items-center justify-center gap-6 p-8 text-center"
  >
    <p class="m-0 text-3xl font-bold text-base-foreground">
      {{ t('linearMode.arrange.noOutputs') }}
    </p>

    <div class="flex w-lg flex-col gap-2 text-lg text-base-foreground">
      <p class="mt-0 p-0">{{ t('linearMode.arrange.switchToOutputs') }}</p>

      <i18n-t keypath="linearMode.arrange.connectAtLeastOne" tag="div">
        <template #atLeastOne>
          <span class="font-bold text-warning-background italic">
            {{ t('linearMode.arrange.atLeastOne') }}
          </span>
        </template>
      </i18n-t>

      <p class="mt-0 p-0">{{ t('linearMode.arrange.outputExamples') }}</p>
    </div>
    <Button
      size="lg"
      :class="
        cn(
          'border bg-primary-background text-(--primary-foreground)',
          'border-primary-background-hover',
          'hover:bg-primary-background-hover'
        )
      "
      data-testid="linear-arrange-switch-to-outputs"
      @click="setMode('builder:outputs')"
    >
      {{ t('linearMode.arrange.switchToOutputsButton') }}
    </Button>
  </div>
</template>
