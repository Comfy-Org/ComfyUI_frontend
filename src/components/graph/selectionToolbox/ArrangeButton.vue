<template>
  <PopoverRoot v-model:open="isOpen">
    <PopoverTrigger as-child>
      <Button
        :tooltip="t('g.arrange')"
        variant="muted-textonly"
        :aria-label="t('g.arrange')"
      >
        <div class="flex items-center gap-1 px-0">
          <i class="icon-[lucide--layout-grid]" />
          <i class="icon-[lucide--chevron-down]" />
        </div>
      </Button>
    </PopoverTrigger>
    <PopoverContent
      :side-offset="5"
      class="w-auto overflow-visible rounded-lg border-border/50 p-2 shadow-sm"
    >
      <div v-if="activeLayout" class="flex w-32 items-center px-2 py-1">
        <Slider
          :model-value="[gap]"
          :min="MIN_ARRANGE_GAP"
          :max="MAX_ARRANGE_GAP"
          :step="1"
          :aria-label="t('g.arrangeSpacing')"
          @update:model-value="onSliderUpdate"
          @value-commit="onSliderCommit"
        />
      </div>
      <div v-else class="flex flex-col gap-1">
        <div class="flex gap-1">
          <Button
            v-for="option in alignOptions"
            :key="option.action"
            :tooltip="t(option.label)"
            variant="muted-textonly"
            :aria-label="t(option.label)"
            @click="align(option.action)"
          >
            <i :class="option.icon" />
          </Button>
        </div>
        <div class="flex gap-1">
          <Button
            :tooltip="t('g.arrangeVertically')"
            variant="muted-textonly"
            :aria-label="t('g.arrangeVertically')"
            @click="start('vertical')"
          >
            <i class="icon-[lucide--stretch-horizontal]" />
          </Button>
          <Button
            :tooltip="t('g.arrangeHorizontally')"
            variant="muted-textonly"
            :aria-label="t('g.arrangeHorizontally')"
            @click="start('horizontal')"
          >
            <i class="icon-[lucide--stretch-vertical]" />
          </Button>
          <Button
            :tooltip="t('g.arrangeAsGrid')"
            variant="muted-textonly"
            :aria-label="t('g.arrangeAsGrid')"
            @click="start('grid')"
          >
            <i class="icon-[lucide--grid-3x3]" />
          </Button>
          <Button
            v-for="option in sizeOptions"
            :key="option.action"
            :tooltip="t(option.label)"
            variant="muted-textonly"
            :aria-label="t(option.label)"
            @click="align(option.action)"
          >
            <i :class="option.icon" />
          </Button>
        </div>
      </div>
      <PopoverArrow class="fill-background stroke-border/50" />
    </PopoverContent>
  </PopoverRoot>
</template>

<script setup lang="ts">
import { PopoverArrow, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import PopoverContent from '@comfyorg/design-system/popover/PopoverContent'
import Slider from '@comfyorg/design-system/slider/Slider'
import {
  MAX_ARRANGE_GAP,
  MIN_ARRANGE_GAP
} from '@/composables/graph/useArrangeNodes'
import { useAlignSelection } from '@/renderer/core/canvas/smartGuides/useAlignSelection'
import { useArrangeSession } from '@/composables/graph/useArrangeSession'
import type { AlignAction } from '@/renderer/core/canvas/smartGuides/alignBoxes'

const { t } = useI18n()
const { activeLayout, gap, start, previewGap, commitGap, reset } =
  useArrangeSession()

const { align } = useAlignSelection()

interface AlignOption {
  action: AlignAction
  label: string
  icon: string
}

const alignOptions: AlignOption[] = [
  {
    action: 'left',
    label: 'g.alignLeft',
    icon: 'icon-[lucide--align-start-vertical]'
  },
  {
    action: 'center',
    label: 'g.alignHorizontalCenters',
    icon: 'icon-[lucide--align-center-vertical]'
  },
  {
    action: 'right',
    label: 'g.alignRight',
    icon: 'icon-[lucide--align-end-vertical]'
  },
  {
    action: 'top',
    label: 'g.alignTop',
    icon: 'icon-[lucide--align-start-horizontal]'
  },
  {
    action: 'middle',
    label: 'g.alignVerticalCenters',
    icon: 'icon-[lucide--align-center-horizontal]'
  },
  {
    action: 'bottom',
    label: 'g.alignBottom',
    icon: 'icon-[lucide--align-end-horizontal]'
  }
]

const sizeOptions: AlignOption[] = [
  {
    action: 'distributeX',
    label: 'g.distributeHorizontally',
    icon: 'icon-[lucide--align-horizontal-space-between]'
  },
  {
    action: 'distributeY',
    label: 'g.distributeVertically',
    icon: 'icon-[lucide--align-vertical-space-between]'
  },
  {
    action: 'matchWidth',
    label: 'g.matchWidth',
    icon: 'icon-[lucide--unfold-horizontal]'
  },
  {
    action: 'matchHeight',
    label: 'g.matchHeight',
    icon: 'icon-[lucide--unfold-vertical]'
  }
]

const isOpen = ref(false)

watch(isOpen, (open) => {
  if (!open) reset()
})

const firstValue = (value: number[] | undefined): number | undefined =>
  value?.[0]

const onSliderUpdate = (value: number[] | undefined) => {
  const next = firstValue(value)
  if (next !== undefined) previewGap(next)
}

const onSliderCommit = (value: number[]) => {
  const next = firstValue(value)
  if (next !== undefined) commitGap(next)
}
</script>
