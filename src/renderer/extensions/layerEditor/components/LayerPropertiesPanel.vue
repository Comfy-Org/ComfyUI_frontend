<template>
  <div
    class="flex w-56 min-w-56 flex-col overflow-y-auto border-l border-border-default bg-base-background"
    data-testid="layer-properties-panel"
  >
    <div
      class="flex items-center gap-2 border-b border-border-default px-3 py-2"
    >
      <i
        :class="
          cn(
            'size-4 shrink-0',
            isLayerContext ? 'icon-[lucide--image]' : 'icon-[lucide--grid-2x2]'
          )
        "
      />
      <span class="truncate text-xs font-semibold text-base-foreground">
        {{ isLayerContext ? activeNode?.name : t('layerEditor.background') }}
      </span>
    </div>

    <template v-if="isLayerContext && activeNode">
      <div :class="sectionClass">
        <span :class="sectionLabelClass">{{ t('layerEditor.position') }}</span>
        <div class="flex gap-2">
          <PropertyNumberField
            label="X"
            :value="round(activeNode.transform.x)"
            @commit="onPosition($event, undefined)"
          />
          <PropertyNumberField
            label="Y"
            :value="round(activeNode.transform.y)"
            @commit="onPosition(undefined, $event)"
          />
        </div>
      </div>

      <div :class="sectionClass">
        <span :class="sectionLabelClass">
          {{ t('layerEditor.dimensions') }}
        </span>
        <div class="flex gap-2">
          <PropertyNumberField
            label="W"
            :value="round(activeNode.transform.w)"
            :min="1"
            @commit="onDimensions($event, undefined)"
          />
          <PropertyNumberField
            label="H"
            :value="round(activeNode.transform.h)"
            :min="1"
            @commit="onDimensions(undefined, $event)"
          />
        </div>
      </div>

      <div :class="sectionClass">
        <span :class="sectionLabelClass">{{ t('layerEditor.alignment') }}</span>
        <div class="flex gap-1">
          <button
            v-for="item in alignItems"
            :key="item.op"
            :class="iconButtonClass"
            :title="item.label"
            :aria-label="item.label"
            @click="onAlign(item.op)"
          >
            <i :class="cn('size-4', item.icon)" />
          </button>
        </div>
      </div>

      <div :class="sectionClass">
        <div class="flex gap-2">
          <div class="flex min-w-0 flex-1 flex-col gap-2">
            <span :class="sectionLabelClass">
              {{ t('layerEditor.rotation') }}
            </span>
            <PropertyNumberField
              label="°"
              :value="rotationDeg"
              @commit="onRotation"
            />
          </div>
          <div class="flex flex-col gap-2">
            <span :class="sectionLabelClass">{{ t('layerEditor.flip') }}</span>
            <div class="flex gap-1">
              <button
                :class="iconButtonClass"
                :title="t('layerEditor.flipHorizontal')"
                :aria-label="t('layerEditor.flipHorizontal')"
                @click="onFlip('h')"
              >
                <i class="icon-[lucide--flip-horizontal-2] size-4" />
              </button>
              <button
                :class="iconButtonClass"
                :title="t('layerEditor.flipVertical')"
                :aria-label="t('layerEditor.flipVertical')"
                @click="onFlip('v')"
              >
                <i class="icon-[lucide--flip-vertical-2] size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div :class="sectionClass">
        <div class="flex gap-2">
          <div class="flex min-w-0 flex-1 flex-col gap-2">
            <span :class="sectionLabelClass">
              {{ t('layerEditor.opacity') }}
            </span>
            <PropertyNumberField
              label="%"
              :value="opacityPercent"
              :min="0"
              :max="100"
              @commit="onOpacity"
            />
          </div>
          <div class="flex min-w-0 flex-1 flex-col gap-2">
            <span :class="sectionLabelClass">
              {{ t('layerEditor.blendMode') }}
            </span>
            <Select
              :model-value="activeNode.mode.blend"
              @update:model-value="onBlendChange"
            >
              <SelectTrigger
                size="md"
                class="h-7 min-w-0 px-2 text-xs"
                :aria-label="t('layerEditor.blendMode')"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="option in blendOptions"
                  :key="option.value"
                  :value="option.value"
                  class="py-1.5 text-xs"
                >
                  {{ option.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <div :class="sectionClass">
        <span :class="sectionLabelClass">
          {{ t('layerEditor.dimensions') }}
        </span>
        <div class="flex gap-2">
          <PropertyNumberField
            label="W"
            :value="canvasSize.w"
            :min="CANVAS_SIZE_MIN"
            :max="CANVAS_SIZE_MAX"
            @commit="session.setCanvasSize($event, canvasSize.h)"
          />
          <PropertyNumberField
            label="H"
            :value="canvasSize.h"
            :min="CANVAS_SIZE_MIN"
            :max="CANVAS_SIZE_MAX"
            @commit="session.setCanvasSize(canvasSize.w, $event)"
          />
        </div>
      </div>

      <div v-if="backgroundLayer" :class="sectionClass">
        <span :class="sectionLabelClass">{{ t('layerEditor.fill') }}</span>
        <div data-testid="background-color-swatch">
          <ColorPicker v-model="backgroundColorModel" class="h-7" />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { AcceptableValue } from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import PropertyNumberField from '@/renderer/extensions/layerEditor/components/PropertyNumberField.vue'
import ColorPicker from '@/components/ui/color-picker/ColorPicker.vue'
import Select from '@/components/ui/select/Select.vue'
import SelectContent from '@/components/ui/select/SelectContent.vue'
import SelectItem from '@/components/ui/select/SelectItem.vue'
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue'
import SelectValue from '@/components/ui/select/SelectValue.vue'
import type {
  LayerEditorAlignOp,
  LayerEditorSession
} from '@/renderer/extensions/layerEditor/composables/useLayerEditorSession'
import {
  CANVAS_SIZE_MAX,
  CANVAS_SIZE_MIN,
  DEFAULT_BACKGROUND_COLOR
} from '@/renderer/extensions/layerEditor/composables/useLayerEditorSession'
import type { BlendFn } from '@/renderer/extensions/layerEditor/engine/mode'
import { LAYER_MODES } from '@/renderer/extensions/layerEditor/engine/mode'
import { cn } from '@comfyorg/tailwind-utils'

const { session } = defineProps<{ session: LayerEditorSession }>()

const { t } = useI18n()
const {
  activeNode,
  activeNodeId,
  selectedContext,
  canvasSize,
  backgroundLayer
} = session

const isLayerContext = computed(
  () => selectedContext.value === 'layer' && activeNode.value !== null
)

const sectionClass = 'flex flex-col gap-2 border-b border-border-default p-3'
const sectionLabelClass = 'text-xs text-muted-foreground'
const iconButtonClass =
  'flex size-7 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-base-foreground transition-colors hover:bg-secondary-background-hover'

const BLEND_KEYS: Record<BlendFn, string> = {
  normal: 'normal',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  darken: 'darken',
  lighten: 'lighten',
  'color-dodge': 'colorDodge',
  'color-burn': 'colorBurn',
  'hard-light': 'hardLight',
  'soft-light': 'softLight',
  difference: 'difference',
  exclusion: 'exclusion',
  'linear-dodge': 'linearDodge',
  'linear-burn': 'linearBurn',
  'vivid-light': 'vividLight',
  'pin-light': 'pinLight',
  'linear-light': 'linearLight',
  'hard-mix': 'hardMix',
  subtract: 'subtract',
  divide: 'divide',
  'grain-extract': 'grainExtract',
  'grain-merge': 'grainMerge',
  hue: 'hue',
  saturation: 'saturation',
  color: 'color',
  luminosity: 'luminosity'
}

const blendOptions = computed(() =>
  (Object.keys(LAYER_MODES) as BlendFn[]).map((mode) => ({
    label: t(`layerEditor.blend.${BLEND_KEYS[mode]}`),
    value: mode
  }))
)

const alignItems = computed<
  { op: LayerEditorAlignOp; icon: string; label: string }[]
>(() => [
  {
    op: 'left',
    icon: 'icon-[lucide--align-start-vertical]',
    label: t('layerEditor.alignLeft')
  },
  {
    op: 'centerH',
    icon: 'icon-[lucide--align-center-vertical]',
    label: t('layerEditor.alignCenterHorizontal')
  },
  {
    op: 'right',
    icon: 'icon-[lucide--align-end-vertical]',
    label: t('layerEditor.alignRight')
  },
  {
    op: 'top',
    icon: 'icon-[lucide--align-start-horizontal]',
    label: t('layerEditor.alignTop')
  },
  {
    op: 'centerV',
    icon: 'icon-[lucide--align-center-horizontal]',
    label: t('layerEditor.alignCenterVertical')
  },
  {
    op: 'bottom',
    icon: 'icon-[lucide--align-end-horizontal]',
    label: t('layerEditor.alignBottom')
  }
])

const rotationDeg = computed(() =>
  Math.round(((activeNode.value?.transform.rotation ?? 0) * 180) / Math.PI)
)

const opacityPercent = computed(() =>
  Math.round((activeNode.value?.opacity ?? 1) * 100)
)

function round(v: number): number {
  return Math.round(v)
}

function onPosition(x?: number, y?: number): void {
  const id = activeNodeId.value
  if (id) session.setLayerPosition(id, x, y)
}

function onDimensions(w?: number, h?: number): void {
  const id = activeNodeId.value
  if (id) session.setLayerDimensions(id, w, h)
}

function onRotation(deg: number): void {
  const id = activeNodeId.value
  if (id) session.setLayerRotationDeg(id, deg)
}

function onAlign(op: LayerEditorAlignOp): void {
  const id = activeNodeId.value
  if (id) session.alignLayer(id, op)
}

function onFlip(axis: 'h' | 'v'): void {
  const id = activeNodeId.value
  if (id) session.flipLayer(id, axis)
}

function onOpacity(percent: number): void {
  const id = activeNodeId.value
  if (id) session.setOpacity(id, percent / 100)
}

function isBlendFn(value: unknown): value is BlendFn {
  return typeof value === 'string' && Object.hasOwn(LAYER_MODES, value)
}

function onBlendChange(value: AcceptableValue): void {
  const id = activeNodeId.value
  if (id && isBlendFn(value)) session.setBlendMode(id, value)
}

const backgroundColor = computed(() => {
  const fill = backgroundLayer.value?.fill
  return fill?.type === 'solid' ? fill.color : DEFAULT_BACKGROUND_COLOR
})

const backgroundColorModel = computed({
  get: () => {
    const percent = Math.round((backgroundLayer.value?.opacity ?? 1) * 100)
    if (percent >= 100) return backgroundColor.value
    const alphaHex = Math.round((percent / 100) * 255)
      .toString(16)
      .padStart(2, '0')
    return `${backgroundColor.value}${alphaHex}`
  },
  set: (hex: string) => {
    session.setBackgroundColor(hex.slice(0, 7))
    session.setBackgroundOpacity(
      hex.length === 9 ? parseInt(hex.slice(7, 9), 16) / 255 : 1
    )
  }
})
</script>
