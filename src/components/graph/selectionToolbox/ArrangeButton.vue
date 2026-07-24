<template>
  <PopoverRoot v-model:open="isOpen">
    <PopoverTrigger as-child>
      <Button
        v-tooltip.top="{ value: t('g.arrange'), showDelay: 1000 }"
        variant="muted-textonly"
        :aria-label="t('g.arrange')"
      >
        <div class="flex items-center gap-1 px-0">
          <i class="icon-[lucide--layout-grid]" />
          <i class="icon-[lucide--chevron-down]" />
        </div>
      </Button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        side="bottom"
        :side-offset="5"
        :collision-padding="10"
        class="data-[state=open]:data-[side=top]:animate-slideDownAndFade data-[state=open]:data-[side=right]:animate-slideLeftAndFade data-[state=open]:data-[side=bottom]:animate-slideUpAndFade data-[state=open]:data-[side=left]:animate-slideRightAndFade z-1700 rounded-lg border border-border-subtle bg-base-background p-2 shadow-sm will-change-[transform,opacity]"
      >
        <div
          v-if="activeLayout"
          class="flex w-32 flex-row items-center px-2 py-1"
        >
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
        <div v-else class="flex flex-row gap-1">
          <Button
            v-tooltip.top="{
              value: t('g.arrangeVertically'),
              showDelay: 1000
            }"
            variant="muted-textonly"
            :aria-label="t('g.arrangeVertically')"
            @click="start('vertical')"
          >
            <i class="icon-[lucide--stretch-horizontal]" />
          </Button>
          <Button
            v-tooltip.top="{
              value: t('g.arrangeHorizontally'),
              showDelay: 1000
            }"
            variant="muted-textonly"
            :aria-label="t('g.arrangeHorizontally')"
            @click="start('horizontal')"
          >
            <i class="icon-[lucide--stretch-vertical]" />
          </Button>
          <Button
            v-tooltip.top="{ value: t('g.arrangeAsGrid'), showDelay: 1000 }"
            variant="muted-textonly"
            :aria-label="t('g.arrangeAsGrid')"
            @click="start('grid')"
          >
            <i class="icon-[lucide--grid-3x3]" />
          </Button>
        </div>
        <PopoverArrow class="fill-base-background stroke-border-subtle" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<script setup lang="ts">
import {
  PopoverArrow,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger
} from 'reka-ui'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Slider from '@/components/ui/slider/Slider.vue'
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
