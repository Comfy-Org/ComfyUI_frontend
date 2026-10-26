<template>
  <PopoverRoot v-model:open="isOpen">
    <PopoverTrigger as-child>
      <Button
        :tooltip="t('g.arrange')"
        variant="muted-textonly"
        :aria-label="t('g.arrange')"
      >
        <div class="flex items-center gap-1 px-0">
          <i class="icon-[lucide--layout-grid] size-[1.2em]" />
          <i class="icon-[lucide--chevron-down] size-[1.2em]" />
        </div>
      </Button>
    </PopoverTrigger>
    <PopoverContent
      :side-offset="5"
      class="w-auto rounded-lg border-border/50 p-2 shadow-sm"
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
      <div v-else class="flex gap-1">
        <Button
          :tooltip="t('g.arrangeVertically')"
          variant="muted-textonly"
          :aria-label="t('g.arrangeVertically')"
          @click="start('vertical')"
        >
          <i class="icon-[lucide--stretch-horizontal] size-[1.2em]" />
        </Button>
        <Button
          :tooltip="t('g.arrangeHorizontally')"
          variant="muted-textonly"
          :aria-label="t('g.arrangeHorizontally')"
          @click="start('horizontal')"
        >
          <i class="icon-[lucide--stretch-vertical] size-[1.2em]" />
        </Button>
        <Button
          :tooltip="t('g.arrangeAsGrid')"
          variant="muted-textonly"
          :aria-label="t('g.arrangeAsGrid')"
          @click="start('grid')"
        >
          <i class="icon-[lucide--grid-3x3] size-[1.2em]" />
        </Button>
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
import { useArrangeSession } from '@/composables/graph/useArrangeSession'

const { t } = useI18n()
const { activeLayout, gap, start, previewGap, commitGap, reset } =
  useArrangeSession()

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
