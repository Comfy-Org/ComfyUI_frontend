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
      <div
        v-if="!imageUrl"
        class="flex size-full flex-col items-center justify-center text-center"
      >
        <i class="mb-2 icon-[lucide--image] h-12 w-12" />
        <p class="text-sm">{{ $t('colorBalance.noInputImage') }}</p>
      </div>

      <canvas
        v-show="imageUrl"
        ref="glCanvas"
        class="block size-full select-none object-contain"
      />
    </div>

    <div
      class="flex h-8 shrink-0 items-center gap-1 rounded-sm bg-component-node-widget-background p-1"
    >
      <Button
        v-for="tab in TABS"
        :key="tab.value"
        variant="textonly"
        size="unset"
        :class="
          cn(
            'flex-1 self-stretch px-2 text-xs transition-colors',
            activeTab === tab.value
              ? 'rounded-sm bg-component-node-widget-background-selected text-base-foreground'
              : 'text-node-text-muted hover:text-node-text'
          )
        "
        @click="activeTab = tab.value"
      >
        {{ $t(tab.label) }}
      </Button>
    </div>

    <template v-for="tab in TABS" :key="tab.value">
      <div
        v-show="activeTab === tab.value"
        class="grid shrink-0 grid-cols-[auto_1fr_auto] gap-x-2 gap-y-1"
      >
        <label class="content-center text-xs text-node-component-slot-text">
          {{ $t('colorBalance.cyanRed') }}
        </label>
        <GradientSlider
          v-model="fields[tab.value].red.value"
          :min="-100"
          :max="100"
          :step="1"
          :stops="CYAN_RED_STOPS"
          class="h-7"
        />
        <input
          v-model.number="fields[tab.value].red.value"
          type="number"
          :min="-100"
          :max="100"
          :step="1"
          class="h-7 w-14 rounded-lg border-none bg-component-node-widget-background px-2 text-xs text-component-node-foreground focus:outline-0"
        />

        <label class="content-center text-xs text-node-component-slot-text">
          {{ $t('colorBalance.magentaGreen') }}
        </label>
        <GradientSlider
          v-model="fields[tab.value].green.value"
          :min="-100"
          :max="100"
          :step="1"
          :stops="MAGENTA_GREEN_STOPS"
          class="h-7"
        />
        <input
          v-model.number="fields[tab.value].green.value"
          type="number"
          :min="-100"
          :max="100"
          :step="1"
          class="h-7 w-14 rounded-lg border-none bg-component-node-widget-background px-2 text-xs text-component-node-foreground focus:outline-0"
        />

        <label class="content-center text-xs text-node-component-slot-text">
          {{ $t('colorBalance.yellowBlue') }}
        </label>
        <GradientSlider
          v-model="fields[tab.value].blue.value"
          :min="-100"
          :max="100"
          :step="1"
          :stops="YELLOW_BLUE_STOPS"
          class="h-7"
        />
        <input
          v-model.number="fields[tab.value].blue.value"
          type="number"
          :min="-100"
          :max="100"
          :step="1"
          class="h-7 w-14 rounded-lg border-none bg-component-node-widget-background px-2 text-xs text-component-node-foreground focus:outline-0"
        />
      </div>
    </template>

    <Button
      variant="secondary"
      size="md"
      class="shrink-0 gap-2 rounded-lg border border-component-node-border bg-component-node-background text-xs text-muted-foreground hover:text-base-foreground"
      @click="resetAll"
    >
      <i class="icon-[lucide--undo-2]" />
      {{ $t('colorBalance.reset') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'

import GradientSlider from '@/components/colorcorrect/GradientSlider.vue'
import {
  CYAN_RED_STOPS,
  MAGENTA_GREEN_STOPS,
  YELLOW_BLUE_STOPS
} from '@/components/colorbalance/gradients'
import Button from '@/components/ui/button/Button.vue'
import { useColorBalance } from '@/composables/useColorBalance'
import { useWebGLColorBalance } from '@/composables/useWebGLColorBalance'
import type { ColorBalanceSettings } from '@/lib/litegraph/src/types/widgets'
import type { NodeId } from '@/platform/workflow/validation/schemas/workflowSchema'
import { cn } from '@/utils/tailwindUtil'

const props = defineProps<{
  nodeId: NodeId
}>()

const modelValue = defineModel<ColorBalanceSettings>({
  default: () => ({
    shadows_red: 0,
    shadows_green: 0,
    shadows_blue: 0,
    midtones_red: 0,
    midtones_green: 0,
    midtones_blue: 0,
    highlights_red: 0,
    highlights_green: 0,
    highlights_blue: 0
  })
})

const TABS = [
  { value: 'shadows' as const, label: 'colorBalance.shadows' },
  { value: 'midtones' as const, label: 'colorBalance.midtones' },
  { value: 'highlights' as const, label: 'colorBalance.highlights' }
]

type TonalRange = 'shadows' | 'midtones' | 'highlights'

const activeTab = ref<string>('shadows')

function rangeFieldAccessor(
  range: TonalRange,
  channel: 'red' | 'green' | 'blue'
) {
  const key = `${range}_${channel}` as keyof ColorBalanceSettings
  return computed({
    get: () => modelValue.value[key],
    set: (v) => {
      modelValue.value = { ...modelValue.value, [key]: v }
    }
  })
}

const fields = {
  shadows: {
    red: rangeFieldAccessor('shadows', 'red'),
    green: rangeFieldAccessor('shadows', 'green'),
    blue: rangeFieldAccessor('shadows', 'blue')
  },
  midtones: {
    red: rangeFieldAccessor('midtones', 'red'),
    green: rangeFieldAccessor('midtones', 'green'),
    blue: rangeFieldAccessor('midtones', 'blue')
  },
  highlights: {
    red: rangeFieldAccessor('highlights', 'red'),
    green: rangeFieldAccessor('highlights', 'green'),
    blue: rangeFieldAccessor('highlights', 'blue')
  }
}

const glCanvas = shallowRef<HTMLCanvasElement | null>(null)

const { imageUrl } = useColorBalance(props.nodeId)
useWebGLColorBalance(glCanvas, imageUrl, modelValue)

function resetAll() {
  modelValue.value = {
    shadows_red: 0,
    shadows_green: 0,
    shadows_blue: 0,
    midtones_red: 0,
    midtones_green: 0,
    midtones_blue: 0,
    highlights_red: 0,
    highlights_green: 0,
    highlights_blue: 0
  }
}
</script>
