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
        <p class="text-sm">{{ $t('colorCurves.noInputImage') }}</p>
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
      <div v-show="activeTab === tab.value" class="mt-1 shrink-0">
        <CurveEditor
          v-model="channels[tab.value].value"
          :curve-color="tab.color"
          :histogram="histogram?.[tab.histogramChannel]"
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
      {{ $t('colorCurves.reset') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'

import CurveEditor from '@/components/colorcurves/CurveEditor.vue'
import Button from '@/components/ui/button/Button.vue'
import { useColorCurves } from '@/composables/useColorCurves'
import { useWebGLColorCurves } from '@/composables/useWebGLColorCurves'
import type {
  ColorCurvesSettings,
  CurvePoint
} from '@/lib/litegraph/src/types/widgets'
import type { NodeId } from '@/platform/workflow/validation/schemas/workflowSchema'
import { cn } from '@/utils/tailwindUtil'

const DEFAULT_CURVE: CurvePoint[] = [
  [0, 0],
  [1, 1]
]

type Channel = keyof ColorCurvesSettings
type HistogramChannel = 'luminance' | 'red' | 'green' | 'blue'

const TABS: {
  value: Channel
  label: string
  color: string
  histogramChannel: HistogramChannel
}[] = [
  {
    value: 'rgb',
    label: 'colorCurves.rgb',
    color: 'white',
    histogramChannel: 'luminance'
  },
  {
    value: 'red',
    label: 'colorCurves.red',
    color: '#ff4444',
    histogramChannel: 'red'
  },
  {
    value: 'green',
    label: 'colorCurves.green',
    color: '#44cc44',
    histogramChannel: 'green'
  },
  {
    value: 'blue',
    label: 'colorCurves.blue',
    color: '#4488ff',
    histogramChannel: 'blue'
  }
]

const props = defineProps<{
  nodeId: NodeId
}>()

const modelValue = defineModel<ColorCurvesSettings>({
  default: () => ({
    rgb: [
      [0, 0],
      [1, 1]
    ] as CurvePoint[],
    red: [
      [0, 0],
      [1, 1]
    ] as CurvePoint[],
    green: [
      [0, 0],
      [1, 1]
    ] as CurvePoint[],
    blue: [
      [0, 0],
      [1, 1]
    ] as CurvePoint[]
  })
})

const activeTab = ref<string>('rgb')

function channelAccessor(channel: Channel) {
  return computed({
    get: () => modelValue.value[channel],
    set: (v) => {
      modelValue.value = { ...modelValue.value, [channel]: v }
    }
  })
}

const channels = {
  rgb: channelAccessor('rgb'),
  red: channelAccessor('red'),
  green: channelAccessor('green'),
  blue: channelAccessor('blue')
}

const glCanvas = shallowRef<HTMLCanvasElement | null>(null)

const { imageUrl, histogram } = useColorCurves(props.nodeId)
useWebGLColorCurves(glCanvas, imageUrl, modelValue)

function resetAll() {
  modelValue.value = {
    rgb: [...DEFAULT_CURVE],
    red: [...DEFAULT_CURVE],
    green: [...DEFAULT_CURVE],
    blue: [...DEFAULT_CURVE]
  }
}
</script>
