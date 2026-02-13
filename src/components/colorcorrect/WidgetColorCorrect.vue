<template>
  <div
    class="widget-expands relative flex h-full w-full flex-col gap-1"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
  >
    <div
      class="relative min-h-0 flex-1 overflow-hidden rounded-[5px] bg-node-component-surface"
    >
      <div v-if="isLoading" class="flex size-full items-center justify-center">
        <span class="text-sm">{{ $t('colorCorrect.loading') }}</span>
      </div>

      <div
        v-else-if="!imageUrl"
        class="flex size-full flex-col items-center justify-center text-center"
      >
        <i class="mb-2 icon-[lucide--image] h-12 w-12" />
        <p class="text-sm">{{ $t('colorCorrect.noInputImage') }}</p>
      </div>

      <template v-else>
        <img
          :src="imageUrl"
          :alt="$t('colorCorrect.previewAlt')"
          draggable="false"
          :style="{ filter: filterStyle }"
          class="block size-full select-none object-contain"
          @load="handleImageLoad"
          @error="handleImageError"
          @dragstart.prevent
        />
        <div
          v-if="temperatureOverlayStyle"
          class="pointer-events-none absolute inset-0"
          :style="temperatureOverlayStyle"
        />
      </template>
    </div>

    <div class="grid shrink-0 grid-cols-[auto_1fr_auto] gap-x-2 gap-y-1">
      <label class="content-center text-xs text-node-component-slot-text">
        {{ $t('colorCorrect.temperature') }}
      </label>
      <GradientSlider
        v-model="temperature"
        :min="-100"
        :max="100"
        :step="1"
        :stops="TEMPERATURE_STOPS"
        class="h-7"
      />
      <input
        v-model.number="temperature"
        type="number"
        :min="-100"
        :max="100"
        :step="1"
        class="h-7 w-14 rounded-lg border-none bg-component-node-widget-background px-2 text-xs text-component-node-foreground focus:outline-0"
      />

      <label class="content-center text-xs text-node-component-slot-text">
        {{ $t('colorCorrect.hue') }}
      </label>
      <GradientSlider
        v-model="hue"
        :min="-90"
        :max="90"
        :step="1"
        :stops="HUE_STOPS"
        class="h-7"
      />
      <input
        v-model.number="hue"
        type="number"
        :min="-90"
        :max="90"
        :step="1"
        class="h-7 w-14 rounded-lg border-none bg-component-node-widget-background px-2 text-xs text-component-node-foreground focus:outline-0"
      />

      <label class="content-center text-xs text-node-component-slot-text">
        {{ $t('colorCorrect.brightness') }}
      </label>
      <GradientSlider
        v-model="brightness"
        :min="-100"
        :max="100"
        :step="1"
        :stops="BRIGHTNESS_STOPS"
        class="h-7"
      />
      <input
        v-model.number="brightness"
        type="number"
        :min="-100"
        :max="100"
        :step="1"
        class="h-7 w-14 rounded-lg border-none bg-component-node-widget-background px-2 text-xs text-component-node-foreground focus:outline-0"
      />

      <label class="content-center text-xs text-node-component-slot-text">
        {{ $t('colorCorrect.contrast') }}
      </label>
      <GradientSlider
        v-model="contrast"
        :min="-100"
        :max="100"
        :step="1"
        :stops="CONTRAST_STOPS"
        class="h-7"
      />
      <input
        v-model.number="contrast"
        type="number"
        :min="-100"
        :max="100"
        :step="1"
        class="h-7 w-14 rounded-lg border-none bg-component-node-widget-background px-2 text-xs text-component-node-foreground focus:outline-0"
      />

      <label class="content-center text-xs text-node-component-slot-text">
        {{ $t('colorCorrect.saturation') }}
      </label>
      <GradientSlider
        v-model="saturation"
        :min="-100"
        :max="100"
        :step="1"
        :stops="SATURATION_STOPS"
        class="h-7"
      />
      <input
        v-model.number="saturation"
        type="number"
        :min="-100"
        :max="100"
        :step="1"
        class="h-7 w-14 rounded-lg border-none bg-component-node-widget-background px-2 text-xs text-component-node-foreground focus:outline-0"
      />

      <label class="content-center text-xs text-node-component-slot-text">
        {{ $t('colorCorrect.gamma') }}
      </label>
      <GradientSlider
        v-model="gamma"
        :min="0.2"
        :max="2.2"
        :step="1"
        :stops="GAMMA_STOPS"
        class="h-7"
      />
      <input
        v-model.number="gamma"
        type="number"
        :min="0.2"
        :max="2.2"
        :step="1"
        class="h-7 w-14 rounded-lg border-none bg-component-node-widget-background px-2 text-xs text-component-node-foreground focus:outline-0"
      />
    </div>

    <Button
      variant="secondary"
      size="md"
      class="shrink-0 gap-2 rounded-lg border border-component-node-border bg-component-node-background text-xs text-muted-foreground hover:text-base-foreground"
      @click="resetAll"
    >
      <i class="icon-[lucide--undo-2]" />
      {{ $t('colorCorrect.reset') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import GradientSlider from '@/components/colorcorrect/GradientSlider.vue'
import {
  BRIGHTNESS_STOPS,
  CONTRAST_STOPS,
  GAMMA_STOPS,
  HUE_STOPS,
  SATURATION_STOPS,
  TEMPERATURE_STOPS
} from '@/components/colorcorrect/gradients'
import Button from '@/components/ui/button/Button.vue'
import { useColorCorrect } from '@/composables/useColorCorrect'
import type { ColorCorrectSettings } from '@/lib/litegraph/src/types/widgets'
import type { NodeId } from '@/platform/workflow/validation/schemas/workflowSchema'

const props = defineProps<{
  nodeId: NodeId
}>()

const modelValue = defineModel<ColorCorrectSettings>({
  default: () => ({
    temperature: 0,
    hue: 0,
    brightness: 0,
    contrast: 0,
    saturation: 0,
    gamma: 1.0
  })
})

function fieldAccessor(key: keyof ColorCorrectSettings) {
  return computed({
    get: () => modelValue.value[key],
    set: (v) => {
      modelValue.value = { ...modelValue.value, [key]: v }
    }
  })
}

const temperature = fieldAccessor('temperature')
const hue = fieldAccessor('hue')
const brightness = fieldAccessor('brightness')
const contrast = fieldAccessor('contrast')
const saturation = fieldAccessor('saturation')
const gamma = fieldAccessor('gamma')

const {
  imageUrl,
  isLoading,
  filterStyle,
  temperatureOverlayStyle,
  handleImageLoad,
  handleImageError
} = useColorCorrect(props.nodeId, modelValue)

function resetAll() {
  modelValue.value = {
    temperature: 0,
    hue: 0,
    brightness: 0,
    contrast: 0,
    saturation: 0,
    gamma: 1.0
  }
}
</script>
