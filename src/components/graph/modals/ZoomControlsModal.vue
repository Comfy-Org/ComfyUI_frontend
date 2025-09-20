<script setup lang="ts">
import type { InputNumberInputEvent } from 'primevue'
import { Button, InputNumber } from 'primevue'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useMinimap } from '@/renderer/extensions/minimap/composables/useMinimap'
import { useCommandStore } from '@/stores/commandStore'

const { t } = useI18n()
const minimap = useMinimap()
const settingStore = useSettingStore()
const commandStore = useCommandStore()
const canvasStore = useCanvasStore()
const { formatKeySequence } = useCommandStore()

interface Props {
  visible: boolean
}

const props = defineProps<Props>()

const interval = ref<number | null>(null)

// Computed properties for reactive states
const minimapToggleText = computed(() =>
  settingStore.get('Comfy.Minimap.Visible')
    ? t('zoomControls.hideMinimap')
    : t('zoomControls.showMinimap')
)

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
const showMinimapCommandText = computed(() =>
  formatKeySequence(commandStore.getCommand('Comfy.Canvas.ToggleMinimap'))
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

<template>
  <div
    v-if="visible"
    class="w-[250px] absolute flex justify-center right-2 md:right-11 z-1300 bottom-[66px] bg-inherit! border-0!"
  >
    <div
      class="bg-white dark-theme:bg-[#2b2b2b] border border-gray-200 dark-theme:border-gray-700 rounded-lg shadow-lg p-4 w-4/5"
      :style="filteredMinimapStyles"
      @click.stop
    >
      <div>
        <Button
          severity="secondary"
          text
          :pt="{
            root: {
              class:
                'flex items-center justify-between cursor-pointer p-2 rounded w-full text-left hover:bg-transparent! focus:bg-transparent! active:bg-transparent!'
            },
            label: {
              class: 'flex flex-col items-start w-full'
            }
          }"
          @mousedown="startRepeat('Comfy.Canvas.ZoomIn')"
          @mouseup="stopRepeat"
          @mouseleave="stopRepeat"
        >
          <template #default>
            <span class="text-sm font-medium block">{{
              $t('graphCanvasMenu.zoomIn')
            }}</span>
            <span class="text-sm text-gray-500 block">{{
              zoomInCommandText
            }}</span>
          </template>
        </Button>

        <Button
          severity="secondary"
          text
          :pt="{
            root: {
              class:
                'flex items-center justify-between cursor-pointer p-2 rounded w-full text-left hover:bg-transparent! focus:bg-transparent! active:bg-transparent!'
            },
            label: {
              class: 'flex flex-col items-start w-full'
            }
          }"
          @mousedown="startRepeat('Comfy.Canvas.ZoomOut')"
          @mouseup="stopRepeat"
          @mouseleave="stopRepeat"
        >
          <template #default>
            <span class="text-sm font-medium block">{{
              $t('graphCanvasMenu.zoomOut')
            }}</span>
            <span class="text-sm text-gray-500 block">{{
              zoomOutCommandText
            }}</span>
          </template>
        </Button>

        <Button
          severity="secondary"
          text
          :pt="{
            root: {
              class:
                'flex items-center justify-between cursor-pointer p-2 rounded w-full text-left hover:bg-transparent! focus:bg-transparent! active:bg-transparent!'
            },
            label: {
              class: 'flex flex-col items-start w-full'
            }
          }"
          @click="executeCommand('Comfy.Canvas.FitView')"
        >
          <template #default>
            <span class="text-sm font-medium block">{{
              $t('zoomControls.zoomToFit')
            }}</span>
            <span class="text-sm text-gray-500 block">{{
              zoomToFitCommandText
            }}</span>
          </template>
        </Button>
        <hr class="border-[#E1DED5] mb-1 dark-theme:border-[#2E3037]" />
        <Button
          severity="secondary"
          text
          data-testid="toggle-minimap-button"
          :pt="{
            root: {
              class:
                'flex items-center justify-between cursor-pointer p-2 rounded w-full text-left hover:bg-transparent! focus:bg-transparent! active:bg-transparent!'
            },
            label: {
              class: 'flex flex-col items-start w-full'
            }
          }"
          @click="executeCommand('Comfy.Canvas.ToggleMinimap')"
        >
          <template #default>
            <span class="text-sm font-medium block">{{
              minimapToggleText
            }}</span>
            <span class="text-sm text-gray-500 block">{{
              showMinimapCommandText
            }}</span>
          </template>
        </Button>
        <hr class="border-[#E1DED5] mt-1 dark-theme:border-[#2E3037]" />
        <div
          ref="zoomInputContainer"
          class="flex items-center px-2 bg-[#E7E6E6] focus-within:bg-[#F3F3F3] dark-theme:bg-[#8282821A] rounded p-2 zoomInputContainer"
        >
          <InputNumber
            ref="zoomInput"
            :default-value="canvasStore.appScalePercentage"
            :min="1"
            :max="1000"
            :show-buttons="false"
            :use-grouping="false"
            :unstyled="true"
            input-class="flex-1 bg-transparent border-none outline-hidden text-sm shadow-none my-0 "
            fluid
            @input="applyZoom"
            @keyup.enter="applyZoom"
          />
          <span class="text-sm text-gray-500 -ml-4">%</span>
        </div>
      </div>
    </div>
  </div>
</template>
<style>
.zoomInputContainer:focus-within {
  border: 1px solid rgb(204, 204, 204);
}

.dark-theme .zoomInputContainer:focus-within {
  border: 1px solid rgb(204, 204, 204);
}
</style>
