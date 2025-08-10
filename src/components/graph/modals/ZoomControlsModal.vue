<template>
  <div
    v-if="visible"
    class="w-[250px] absolute flex justify-center right-[100px] z-[1200] bottom-[50px] !bg-inherit !border-0"
  >
    <div
      class="bg-white dark-theme:bg-[#2b2b2b] border border-gray-200 dark-theme:border-gray-700 rounded-lg shadow-lg p-4 w-4/5"
      :style="filteredMinimapStyles"
      @click.stop
    >
      <div class="space-y-3">
        <Button
          severity="secondary"
          text
          :pt="{
            root: {
              class:
                'flex items-center justify-between cursor-pointer p-2 rounded w-full text-left hover:!bg-transparent focus:!bg-transparent active:!bg-transparent'
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
              $t('zoomControls.zoomInShortcut')
            }}</span>
          </template>
        </Button>

        <Button
          severity="secondary"
          text
          :pt="{
            root: {
              class:
                'flex items-center justify-between cursor-pointer p-2 rounded w-full text-left hover:!bg-transparent focus:!bg-transparent active:!bg-transparent'
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
              $t('zoomControls.zoomOutShortcut')
            }}</span>
          </template>
        </Button>

        <Button
          severity="secondary"
          text
          :pt="{
            root: {
              class:
                'flex items-center justify-between cursor-pointer p-2 rounded w-full text-left hover:!bg-transparent focus:!bg-transparent active:!bg-transparent'
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
              $t('zoomControls.zoomToFitShortcut')
            }}</span>
          </template>
        </Button>
        <hr class="border-[#E1DED5] dark-theme:border-[#2E3037]" />
        <Button
          severity="secondary"
          text
          :pt="{
            root: {
              class:
                'flex items-center justify-between cursor-pointer p-2 rounded w-full text-left hover:!bg-transparent focus:!bg-transparent active:!bg-transparent'
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
              $t('zoomControls.showMinimapShortcut')
            }}</span>
          </template>
        </Button>
        <div
          class="flex items-center px-2 bg-[#E7E6E6] dark-theme:bg-[#444444] rounded p-2"
        >
          <InputNumber
            ref="zoomInput"
            :default-value="canvasStore.appScalePercentage"
            :min="1"
            :max="100"
            :show-buttons="false"
            :use-grouping="false"
            :unstyled="true"
            input-class="flex-1 bg-transparent border-none outline-none text-sm shadow-none my-0"
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

<script setup lang="ts">
import { Button, InputNumber, InputNumberInputEvent } from 'primevue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useMinimap } from '@/composables/useMinimap'
import { useCommandStore } from '@/stores/commandStore'
import { useCanvasStore } from '@/stores/graphStore'
import { useSettingStore } from '@/stores/settingStore'

const { t } = useI18n()
const minimap = useMinimap()
const settingStore = useSettingStore()
const commandStore = useCommandStore()
const canvasStore = useCanvasStore()

interface Props {
  visible: boolean
}

defineProps<Props>()

const interval = ref<number | null>(null)

// Computed properties for reactive states
const minimapToggleText = computed(() =>
  settingStore.get('Comfy.Minimap.Visible')
    ? t('zoomControls.hideMinimap')
    : t('zoomControls.showMinimap')
)

const applyZoom = (val: InputNumberInputEvent) => {
  const inputValue = val.value as number
  if (isNaN(inputValue) || inputValue < 1 || inputValue > 100) {
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
</script>
