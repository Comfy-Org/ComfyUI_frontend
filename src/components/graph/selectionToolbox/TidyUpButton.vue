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
    <SelectionToolboxBar
      :open="isOpen"
      keep-open-for="[data-selection-toolbox], [data-gap-handle]"
    >
      <div class="flex h-8 w-44 items-center gap-2 pr-1 pl-3">
        <Slider
          :model-value="[clamp(gap, MIN_TIDY_GAP, MAX_TIDY_GAP)]"
          :min="MIN_TIDY_GAP"
          :max="MAX_TIDY_GAP"
          :step="1"
          :aria-label="t('g.gapHandle')"
          @update:model-value="onSliderUpdate"
          @value-commit="onSliderCommit"
        />
        <span class="min-w-6 shrink-0 text-right text-xs tabular-nums">
          {{ hasMixedGaps ? t('g.mixedGaps') : gap }}
        </span>
      </div>
    </SelectionToolboxBar>
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
import { PopoverRoot, PopoverTrigger } from 'reka-ui'
import { onBeforeUnmount, watch } from 'vue'
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
import SelectionToolboxBar from '@/components/graph/selectionToolbox/SelectionToolboxBar.vue'
import {
  LIFT_WHILE_OPEN,
  hasSameMembers
} from '@/components/graph/selectionToolbox/selectionToolboxBar'

const { t } = useI18n()
const { canTidy, gridNodes } = useSelectionGrid()
const { gap, hasMixedGaps, handles, start, previewGap, commitGap, finish } =
  useTidySession()
const lift = defineModel<number>('lift', { default: 0 })

const isOpen = defineModel<boolean>('open', { default: false })

watch(isOpen, (open) => {
  lift.value = open ? LIFT_WHILE_OPEN : 0
  if (open) start()
  else finish()
})

watch(gridNodes, (nodes, previous) => {
  if (!hasSameMembers(nodes, previous)) isOpen.value = false
})

onBeforeUnmount(() => {
  isOpen.value = false
  lift.value = 0
})

const applySliderGap = (
  value: number[] | undefined,
  apply: (gap: number) => void
) => {
  const next = value?.[0]
  if (next !== undefined) apply(next)
}

const onSliderUpdate = (value: number[] | undefined) =>
  applySliderGap(value, previewGap)

const onSliderCommit = (value: number[]) => applySliderGap(value, commitGap)
</script>
