<template>
  <div
    v-if="visible"
    ref="modalRoot"
    class="absolute right-0 bottom-[62px] z-1300 flex w-[250px] justify-center border-0! bg-inherit!"
  >
    <div
      class="w-4/5 rounded-lg border border-interface-stroke bg-interface-panel-surface p-2 text-text-primary shadow-lg select-none"
      :style="filteredMinimapStyles"
      @click.stop
    >
      <div class="flex flex-col gap-1">
        <div
          class="flex cursor-pointer items-center justify-between rounded-sm px-3 py-2 text-sm hover:bg-node-component-surface-hovered"
          data-testid="zoom-in-action"
          @mousedown="startRepeat('Comfy.Canvas.ZoomIn')"
          @mouseup="stopRepeat"
          @mouseleave="stopRepeat"
        >
          <span class="font-medium">{{ $t('graphCanvasMenu.zoomIn') }}</span>
          <span class="text-[9px] text-text-primary">{{
            zoomInCommandText
          }}</span>
        </div>

        <div
          class="flex cursor-pointer items-center justify-between rounded-sm px-3 py-2 text-sm hover:bg-node-component-surface-hovered"
          data-testid="zoom-out-action"
          @mousedown="startRepeat('Comfy.Canvas.ZoomOut')"
          @mouseup="stopRepeat"
          @mouseleave="stopRepeat"
        >
          <span class="font-medium">{{ $t('graphCanvasMenu.zoomOut') }}</span>
          <span class="text-[9px] text-text-primary">{{
            zoomOutCommandText
          }}</span>
        </div>

        <div
          class="flex cursor-pointer items-center justify-between rounded-sm px-3 py-2 text-sm hover:bg-node-component-surface-hovered"
          data-testid="zoom-to-fit-action"
          @click="executeCommand('Comfy.Canvas.FitView')"
        >
          <span class="font-medium">{{ $t('zoomControls.zoomToFit') }}</span>
          <span class="text-[9px] text-text-primary">{{
            zoomToFitCommandText
          }}</span>
        </div>

        <NumberField
          :model-value="canvasStore.appScalePercentage"
          :min="1"
          :max="1000"
          :format-options="{ useGrouping: false, maximumFractionDigits: 0 }"
          data-testid="zoom-percentage-input"
          @update:model-value="canvasStore.setAppZoomFromPercentage"
        >
          <NumberFieldDecrement />
          <NumberFieldInput :aria-label="$t('zoomControls.zoomPercentage')" />
          <span class="shrink-0 text-sm text-text-primary">%</span>
          <NumberFieldIncrement />
        </NumberField>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'

import NumberField from '@/components/ui/number-field/NumberField.vue'
import NumberFieldDecrement from '@/components/ui/number-field/NumberFieldDecrement.vue'
import NumberFieldIncrement from '@/components/ui/number-field/NumberFieldIncrement.vue'
import NumberFieldInput from '@/components/ui/number-field/NumberFieldInput.vue'
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
