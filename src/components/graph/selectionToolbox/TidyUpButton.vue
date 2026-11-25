<template>
  <PopoverRoot v-model:open="isOpen">
    <PopoverTrigger as-child>
      <Button
        :tooltip="t('g.tidyUpTooltip')"
        :variant="isOpen ? 'secondary' : 'muted-textonly'"
        :aria-label="t('g.tidyUp')"
        :disabled="!canTidy"
      >
        <i class="icon-[lucide--layout-dashboard]" />
      </Button>
    </PopoverTrigger>
    <PopoverPortal :key="Number(isOpen)">
      <PopoverContent
        side="bottom"
        :side-offset="BAR_SIDE_OFFSET"
        :collision-padding="10"
        update-position-strategy="always"
        class="z-overlay floating-panel will-change-[transform,opacity] data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        @interact-outside="keepOpenForToolboxAndHandles"
      >
        <div class="flex h-8 w-44 items-center gap-2 pr-1 pl-3">
          <Slider
            :model-value="[clamp(gap, MIN_TIDY_GAP, MAX_TIDY_GAP)]"
            :min="MIN_TIDY_GAP"
            :max="MAX_TIDY_GAP"
            :step="1"
            :disabled="!canTidy"
            :aria-label="t('g.gapHandle')"
            @pointerdown.capture="onSliderPointerDown"
            @pointerup.capture="onSliderPointerEnd"
            @pointercancel="onSliderPointerEnd"
            @lostpointercapture="onSliderPointerEnd"
            @update:model-value="onSliderUpdate"
          />
          <span class="min-w-6 shrink-0 text-right text-xs tabular-nums">
            {{ hasMixedGaps ? t('g.mixedGaps') : gap }}
          </span>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
  <Teleport to="body">
    <SelectionGapHandles
      v-if="isOpen && canTidy"
      :session="handles"
      @dismiss="isOpen = false"
    />
  </Teleport>
</template>

<script setup lang="ts">
import { clamp } from 'es-toolkit'
import type { FocusOutsideEvent, PointerDownOutsideEvent } from 'reka-ui'
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger
} from 'reka-ui'
import { onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import Slider from '@comfyorg/design-system/slider/Slider'
import SelectionGapHandles from '@/components/graph/selectionGrid/SelectionGapHandles.vue'
import {
  MAX_TIDY_GAP,
  MIN_TIDY_GAP
} from '@/components/graph/selectionGrid/selectionGridLayout'
import { useSelectionGrid } from '@/components/graph/selectionGrid/useSelectionGrid'
import { useTidySession } from '@/components/graph/selectionGrid/useTidySession'

const TOOLBOX_INSET = 4
const BAR_GAP_BELOW_TOOLBOX = 8
const BAR_INSET = 4
const TRIGGER_HEIGHT = 32
const BAR_SIDE_OFFSET = TOOLBOX_INSET + BAR_GAP_BELOW_TOOLBOX
const LIFT_WHILE_OPEN = BAR_SIDE_OFFSET + BAR_INSET + TRIGGER_HEIGHT

const { t } = useI18n()
const { canTidy, gridNodes } = useSelectionGrid()
const { gap, hasMixedGaps, handles, start, previewGap, commitGap, finish } =
  useTidySession()
const lift = defineModel<number>('lift', { default: 0 })

const isOpen = ref(false)
let sliderPointer: number | undefined

watch(isOpen, (open) => {
  lift.value = open ? LIFT_WHILE_OPEN : 0
  if (open) start()
  else {
    sliderPointer = undefined
    finish()
  }
})

function hasSameNodes<T>(nodes: T[], previous: T[]) {
  const previousNodes = new Set(previous)
  return (
    nodes.length === previousNodes.size &&
    nodes.every((node) => previousNodes.has(node))
  )
}

watch([gridNodes, canTidy], ([nodes, eligible], [previous]) => {
  if (!eligible || !hasSameNodes(nodes, previous)) isOpen.value = false
})

onBeforeUnmount(() => {
  lift.value = 0
})

function keepOpenForToolboxAndHandles(
  event: FocusOutsideEvent | PointerDownOutsideEvent
) {
  const { target } = event.detail.originalEvent
  if (
    target instanceof Element &&
    target.closest('[data-selection-toolbox], [data-gap-handle]')
  ) {
    event.preventDefault()
  }
}

function onSliderPointerDown(event: PointerEvent) {
  if (canTidy.value && event.button === 0 && sliderPointer === undefined)
    sliderPointer = event.pointerId
}

function onSliderPointerEnd(event: PointerEvent) {
  if (sliderPointer !== event.pointerId) return
  sliderPointer = undefined
  finish()
}

function onSliderUpdate(value: number[] | undefined) {
  const next = value?.[0]
  if (next === undefined || !canTidy.value) return
  if (sliderPointer === undefined) commitGap(next)
  else previewGap(next)
}
</script>
