<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'

import Button from '@/components/ui/button/Button.vue'
import { useAppMode } from '@/composables/useAppMode'
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
    class="mx-auto flex size-full flex-col items-center justify-center gap-6 p-8"
  >
    <!-- Square placeholder sized to match BuilderToolbar's width
         so it reads as a vertical extension of the stepper above.
         The toolbar is content-driven but its content is fixed
         (3 i18n labels), so a hardcoded width is fine — bump in
         lockstep with the toolbar if its content ever changes. The
         translateX nudges the box onto the toolbar's viewport-
         centered axis (the backdrop is sidebar-offset, which would
         otherwise push the center sidebar-width/2 to the right). -->
    <div
      class="flex aspect-square w-132 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-(--color-app-mode-active-temp) p-12"
      style="transform: translateX(calc(-0.5 * var(--sidebar-width, 0px)))"
    >
      <p class="m-0 text-3xl font-bold text-base-foreground">
        {{ t('linearMode.arrange.outputs') }}
      </p>
      <p class="m-0 max-w-prose text-center text-lg text-base-foreground">
        {{ t('linearMode.arrange.resultsLabel') }}
      </p>
      <p class="m-0 max-w-prose text-center text-lg text-base-foreground">
        {{ t('linearMode.arrange.dragHint') }}
      </p>
      <!-- Drag-to-reorder demo: bottom block lifts up beside the middle
           block (1-col → 2-col) and back. Timeline reads as pause →
           drag-up → hold → drag-back → pause; cubic-bezier(0.83, 0, 0.17, 1) smooths
           every segment so moves accelerate out of rest and settle. -->
      <svg
        class="drag-demo mt-2 w-3/4 max-w-sm text-(--color-app-mode-active-temp)"
        viewBox="0 0 240 144"
        aria-hidden="true"
      >
        <!-- Panel chrome: matches the real panel header — collapse chevron
             on the left, three-dot more-menu on the right. -->
        <rect class="frame" x="4" y="4" width="232" height="136" rx="10" />
        <line class="frame" x1="4" y1="28" x2="236" y2="28" />
        <path class="frame" d="M14 15 L18 19 L22 15" />
        <circle class="frame-dot" cx="210" cy="16" r="1.5" />
        <circle class="frame-dot" cx="217" cy="16" r="1.5" />
        <circle class="frame-dot" cx="224" cy="16" r="1.5" />

        <!-- Content blocks inside the panel — 12px margin on all sides,
             8px gap between rows AND between side-by-side columns. -->
        <rect x="16" y="40" width="208" height="24" rx="6" />
        <rect class="shrinks" x="16" y="72" width="208" height="24" rx="6" />
        <rect
          class="mover shrinks"
          x="16"
          y="104"
          width="208"
          height="24"
          rx="6"
        />
        <path class="cursor" d="M0 0 L0 16 L4 13 L7 19 L9 18 L6 12 L11 11 Z" />
      </svg>
    </div>
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
          <span class="font-bold text-(--color-app-mode-active-temp) italic">
            {{ t('linearMode.arrange.atLeastOne') }}
          </span>
        </template>
      </i18n-t>

      <p class="mt-0 p-0">{{ t('linearMode.arrange.outputExamples') }}</p>
    </div>
    <div class="flex flex-row gap-2">
      <!-- Color override matches the Save button (BuilderFooterToolbar)
           — uses the temp App Mode accent purple instead of the brand
           blue `variant="primary"` token. -->
      <Button
        size="lg"
        :class="[
          'border bg-(--color-app-mode-accent-temp) text-white',
          'border-(--color-app-mode-accent-temp-deep)',
          'hover:bg-(--color-app-mode-accent-temp-deep)'
        ]"
        data-testid="linear-arrange-switch-to-outputs"
        @click="setMode('builder:outputs')"
      >
        {{ t('linearMode.arrange.switchToOutputsButton') }}
      </Button>
    </div>
  </div>
</template>

<style scoped>
/* Easing is cubic-bezier(0.83, 0, 0.17, 1) (easeInOutQuint) — the
   pronounced curve makes the pause→drag→pause rhythm legible. The
   mover layers two animations via the comma-separated list. */
.drag-demo rect {
  fill: currentColor;
}
.drag-demo .frame {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.drag-demo .frame-dot {
  fill: currentColor;
}
.drag-demo .shrinks {
  animation: drag-shrink 4s cubic-bezier(0.83, 0, 0.17, 1) infinite;
}
.drag-demo .mover {
  animation:
    drag-translate 4s cubic-bezier(0.83, 0, 0.17, 1) infinite,
    drag-shrink 4s cubic-bezier(0.83, 0, 0.17, 1) infinite;
}
.drag-demo .cursor {
  fill: currentColor;
  stroke: var(--color-layout-canvas, #0a0a0a);
  /* Doubled to match the frame's visible 1.5: paint-order paints stroke
     under fill, so the fill covers the inner half — only the outer 1.5
     ends up visible, matching the wireframe outline. */
  stroke-width: 3;
  stroke-linejoin: round;
  stroke-linecap: round;
  paint-order: stroke;
  animation: drag-cursor 4s cubic-bezier(0.83, 0, 0.17, 1) infinite;
}

@keyframes drag-shrink {
  0%,
  20%,
  80%,
  100% {
    width: 208px;
  }
  40%,
  60% {
    width: 100px;
  }
}
@keyframes drag-translate {
  0%,
  20%,
  80%,
  100% {
    transform: translate(0, 0);
  }
  40%,
  60% {
    transform: translate(108px, -32px);
  }
}
@keyframes drag-cursor {
  0%,
  20%,
  80%,
  100% {
    transform: translate(120px, 116px);
  }
  40%,
  60% {
    transform: translate(174px, 84px);
  }
}
</style>
