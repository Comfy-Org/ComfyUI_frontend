<template>
  <div
    v-if="visible"
    class="absolute right-2 bottom-[66px] z-1300 flex w-[250px] justify-center border-0! bg-inherit! md:right-11"
  >
    <div
      class="w-4/5 rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark-theme:border-gray-700 dark-theme:bg-[#2b2b2b]"
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
            <span class="block text-sm font-medium">{{
              $t('graphCanvasMenu.zoomIn')
            }}</span>
            <span class="block text-sm text-gray-500">{{
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
            <span class="block text-sm font-medium">{{
              $t('graphCanvasMenu.zoomOut')
            }}</span>
            <span class="block text-sm text-gray-500">{{
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
            <span class="block text-sm font-medium">{{
              $t('zoomControls.zoomToFit')
            }}</span>
            <span class="block text-sm text-gray-500">{{
              zoomToFitCommandText
            }}</span>
          </template>
        </Button>
        <hr class="mb-1 border-[#E1DED5] dark-theme:border-[#2E3037]" />
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
            <span class="block text-sm font-medium">{{
              minimapToggleText
            }}</span>
            <span class="block text-sm text-gray-500">{{
              showMinimapCommandText
            }}</span>
          </template>
        </Button>
        <hr class="mt-1 border-[#E1DED5] dark-theme:border-[#2E3037]" />
        <div
          ref="zoomInputContainer"
          class="zoomInputContainer flex items-center rounded bg-[#E7E6E6] p-2 px-2 focus-within:bg-[#F3F3F3] dark-theme:bg-[#8282821A]"
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
          <span class="-ml-4 text-sm text-gray-500">%</span>
        </div>
      </div>
    </div>
  </div>
</template>

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

const emit = defineEmits<{
  close: []
}>()

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
  if (command === 'Comfy.Canvas.ToggleMinimap') {
    emit('close')
  }
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
<style>
.zoomInputContainer:focus-within {
  border: 1px solid rgb(204 204 204);
}

.dark-theme .zoomInputContainer:focus-within {
  border: 1px solid rgb(204 204 204);
}
</style>
