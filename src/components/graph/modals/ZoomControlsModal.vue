<template>
  <div
    v-if="visible"
    ref="modalRoot"
    class="absolute right-0 bottom-[62px] z-1300 flex w-[250px] justify-center border-0! bg-inherit!"
  >
    <div
      class="w-4/5 rounded-lg border bg-background p-2 text-foreground shadow-lg select-none"
      :style="filteredMinimapStyles"
      @click.stop
    >
      <div class="flex flex-col gap-1">
        <div
          class="flex cursor-pointer items-center justify-between rounded-sm px-3 py-2 text-sm hover:bg-accent"
          data-testid="zoom-in-action"
          @mousedown="startRepeat('Comfy.Canvas.ZoomIn')"
          @mouseup="stopRepeat"
          @mouseleave="stopRepeat"
        >
          <span class="font-medium">{{ $t('graphCanvasMenu.zoomIn') }}</span>
          <span class="text-[9px]">{{ zoomInCommandText }}</span>
        </div>

        <div
          class="flex cursor-pointer items-center justify-between rounded-sm px-3 py-2 text-sm hover:bg-accent"
          data-testid="zoom-out-action"
          @mousedown="startRepeat('Comfy.Canvas.ZoomOut')"
          @mouseup="stopRepeat"
          @mouseleave="stopRepeat"
        >
          <span class="font-medium">{{ $t('graphCanvasMenu.zoomOut') }}</span>
          <span class="text-[9px]">{{ zoomOutCommandText }}</span>
        </div>

        <div
          class="flex cursor-pointer items-center justify-between rounded-sm px-3 py-2 text-sm hover:bg-accent"
          data-testid="zoom-to-fit-action"
          @click="executeCommand('Comfy.Canvas.FitView')"
        >
          <span class="font-medium">{{ $t('zoomControls.zoomToFit') }}</span>
          <span class="text-[9px]">{{ zoomToFitCommandText }}</span>
        </div>

        <FormNumberField
          class="w-full"
          :model-value="canvasStore.appScalePercentage"
          :min="1"
          :max="1000"
          :format-options="{ useGrouping: false, maximumFractionDigits: 0 }"
          :aria-label="$t('zoomControls.zoomPercentage')"
          data-testid="zoom-percentage-input"
          @update:model-value="canvasStore.setAppZoomFromPercentage"
        >
          <template #suffix>
            <span class="shrink-0 text-sm">%</span>
          </template>
        </FormNumberField>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'

import FormNumberField from '@/components/common/FormNumberField.vue'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useMinimap } from '@/renderer/extensions/minimap/composables/useMinimap'
import { useCommandStore } from '@/stores/commandStore'

const minimap = useMinimap()
const commandStore = useCommandStore()
const canvasStore = useCanvasStore()
const { formatKeySequence } = useCommandStore()

interface Props {
  visible: boolean
}

const props = defineProps<Props>()

const interval = ref<number | null>(null)

const executeCommand = (command: string) => {
  void commandStore.execute(command)
}

const startRepeat = (command: string) => {
  if (interval.value) return
  const cmd = () => commandStore.execute(command)
  void cmd()
  interval.value = window.setInterval(cmd, 100)
}

const stopRepeat = () => {
  if (interval.value) {
    clearInterval(interval.value)
    interval.value = null
  }
}
const filteredMinimapStyles = computed(() => {
  return {
    ...minimap.containerStyles.value,
    height: undefined,
    width: undefined
  }
})
const zoomInCommandText = computed(() =>
  formatKeySequence(commandStore.getCommand('Comfy.Canvas.ZoomIn'))
)
const zoomOutCommandText = computed(() =>
  formatKeySequence(commandStore.getCommand('Comfy.Canvas.ZoomOut'))
)
const zoomToFitCommandText = computed(() =>
  formatKeySequence(commandStore.getCommand('Comfy.Canvas.FitView'))
)
const modalRoot = useTemplateRef<HTMLDivElement>('modalRoot')

watch(
  () => props.visible,
  async (visible) => {
    if (!visible) return
    await nextTick()
    modalRoot.value?.querySelector('input')?.focus()
  }
)
</script>
