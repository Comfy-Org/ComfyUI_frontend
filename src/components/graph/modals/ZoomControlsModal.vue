<template>
  <DropdownMenuItem
    data-testid="zoom-in-action"
    @select.prevent
    @mousedown="startRepeat('Comfy.Canvas.ZoomIn')"
    @mouseup="stopRepeat"
    @mouseleave="stopRepeat"
  >
    {{ $t('graphCanvasMenu.zoomIn') }}
    <DropdownMenuShortcut>{{ zoomInCommandText }}</DropdownMenuShortcut>
  </DropdownMenuItem>

  <DropdownMenuItem
    data-testid="zoom-out-action"
    @select.prevent
    @mousedown="startRepeat('Comfy.Canvas.ZoomOut')"
    @mouseup="stopRepeat"
    @mouseleave="stopRepeat"
  >
    {{ $t('graphCanvasMenu.zoomOut') }}
    <DropdownMenuShortcut>{{ zoomOutCommandText }}</DropdownMenuShortcut>
  </DropdownMenuItem>

  <DropdownMenuItem
    data-testid="zoom-to-fit-action"
    @select="executeCommand('Comfy.Canvas.FitView')"
  >
    {{ $t('zoomControls.zoomToFit') }}
    <DropdownMenuShortcut>{{ zoomToFitCommandText }}</DropdownMenuShortcut>
  </DropdownMenuItem>

  <div
    ref="zoomInputContainer"
    class="zoomInputContainer mt-1 flex items-center gap-1 rounded-sm bg-input-surface p-2"
    data-testid="zoom-percentage-input"
    @click.stop
    @keydown.stop
  >
    <InputNumber
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
    <span class="shrink-0 text-sm text-text-primary">%</span>
  </div>
</template>

<script setup lang="ts">
import type { InputNumberInputEvent } from 'primevue'
import { InputNumber } from 'primevue'
import { computed, nextTick, onMounted, ref } from 'vue'

import DropdownMenuItem from '@/components/ui/dropdown-menu/DropdownMenuItem.vue'
import DropdownMenuShortcut from '@/components/ui/dropdown-menu/DropdownMenuShortcut.vue'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCommandStore } from '@/stores/commandStore'

const commandStore = useCommandStore()
const canvasStore = useCanvasStore()
const { formatKeySequence } = useCommandStore()

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

const zoomInCommandText = computed(() =>
  formatKeySequence(commandStore.getCommand('Comfy.Canvas.ZoomIn'))
)
const zoomOutCommandText = computed(() =>
  formatKeySequence(commandStore.getCommand('Comfy.Canvas.ZoomOut'))
)
const zoomToFitCommandText = computed(() =>
  formatKeySequence(commandStore.getCommand('Comfy.Canvas.FitView'))
)
const zoomInputContainer = ref<HTMLDivElement | null>(null)

onMounted(async () => {
  await nextTick()
  const input = zoomInputContainer.value?.querySelector(
    'input'
  ) as HTMLInputElement | null
  input?.focus()
})
</script>
<style>
.zoomInputContainer:focus-within {
  border: 1px solid var(--color-white);
}
</style>
