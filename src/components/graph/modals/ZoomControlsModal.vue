<template>
  <div
    v-if="visible"
    class="absolute right-2 bottom-[66px] z-1300 flex w-[250px] justify-center border-0! bg-inherit!"
  >
    <div
      class="text-neutral w-4/5 rounded-lg border border-zinc-200 bg-interface-panel-surface p-2 shadow-lg select-none dark-theme:border-zinc-700 dark-theme:text-white"
      :style="filteredMinimapStyles"
      @click.stop
    >
      <div class="flex flex-col gap-1">
        <div
          class="flex cursor-pointer items-center justify-between rounded px-3 py-2 text-sm hover:bg-gray-100 dark-theme:hover:bg-zinc-700"
          @mousedown="startRepeat('Comfy.Canvas.ZoomIn')"
          @mouseup="stopRepeat"
          @mouseleave="stopRepeat"
        >
          <span class="font-medium">{{ $t('graphCanvasMenu.zoomIn') }}</span>
          <span class="text-gray-500">{{ zoomInCommandText }}</span>
        </div>

        <div
          class="flex cursor-pointer items-center justify-between rounded px-3 py-2 text-sm hover:bg-gray-100 dark-theme:hover:bg-zinc-700"
          @mousedown="startRepeat('Comfy.Canvas.ZoomOut')"
          @mouseup="stopRepeat"
          @mouseleave="stopRepeat"
        >
          <span class="font-medium">{{ $t('graphCanvasMenu.zoomOut') }}</span>
          <span class="text-gray-500">{{ zoomOutCommandText }}</span>
        </div>

        <div
          class="flex cursor-pointer items-center justify-between rounded px-3 py-2 text-sm hover:bg-gray-100 dark-theme:hover:bg-zinc-700"
          @click="executeCommand('Comfy.Canvas.FitView')"
        >
          <span class="font-medium">{{ $t('zoomControls.zoomToFit') }}</span>
          <span class="text-gray-500">{{ zoomToFitCommandText }}</span>
        </div>

        <div
          ref="zoomInputContainer"
          class="zoomInputContainer flex items-center gap-1 rounded bg-[#E7E6E6] p-2 focus-within:bg-[#F3F3F3] dark-theme:bg-[#8282821A]"
        >
          <InputNumber
            ref="zoomInput"
            :default-value="canvasStore.appScalePercentage"
            :min="1"
            :max="1000"
            :show-buttons="false"
            :use-grouping="false"
            :unstyled="true"
            input-class="bg-transparent border-none outline-hidden text-sm shadow-none my-0 w-full"
            fluid
            @input="applyZoom"
            @keyup.enter="applyZoom"
          />
          <span class="flex-shrink-0 text-sm text-gray-500">%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { InputNumberInputEvent } from 'primevue'
import { InputNumber } from 'primevue'
import { computed, nextTick, ref, watch } from 'vue'

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

const applyZoom = (val: InputNumberInputEvent) => {
  const inputValue = val.value as number
  if (isNaN(inputValue) || inputValue < 1 || inputValue > 1000) {
    return
  }
  canvasStore.setAppZoomFromPercentage(inputValue)
}

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
const zoomInput = ref<InstanceType<typeof InputNumber> | null>(null)
const zoomInputContainer = ref<HTMLDivElement | null>(null)

watch(
  () => props.visible,
  async (newVal) => {
    if (newVal) {
      await nextTick()
      const input = zoomInputContainer.value?.querySelector(
        'input'
      ) as HTMLInputElement
      input?.focus()
    }
  }
)
</script>
<style>
.zoomInputContainer:focus-within {
  border: 1px solid rgb(204 204 204);
}

.dark-theme .zoomInputContainer:focus-within {
  border: 1px solid rgb(204 204 204);
}
</style>
