<template>
  <PopoverRoot>
    <PopoverTrigger as-child>
      <Button
        :tooltip="t('g.align')"
        variant="muted-textonly"
        :aria-label="t('g.align')"
      >
        <div class="flex items-center gap-1 px-0">
          <i class="icon-[lucide--align-start-vertical]" />
          <i class="icon-[lucide--chevron-down]" />
        </div>
      </Button>
    </PopoverTrigger>
    <PopoverContent
      side="top"
      :side-offset="5"
      class="w-fit overflow-visible rounded-lg border-border/50 p-2 shadow-sm"
    >
      <div
        class="flex flex-wrap gap-1"
        :style="alignRowStyle(alignOptionCount)"
      >
        <div
          v-for="(groups, section) in alignOptionSections"
          :key="section"
          class="flex min-w-0 flex-wrap gap-1"
          :style="alignRowStyle(Object.values(groups).flat().length)"
        >
          <div
            v-for="(options, group) in groups"
            :key="group"
            class="flex gap-1"
          >
            <ToolboxButton
              v-for="option in options"
              :key="option.action"
              :label="t(option.label)"
              :icon="option.icon"
              :disabled="!canAlign(option.action)"
              @click="align(option.action)"
            />
          </div>
        </div>
      </div>
      <PopoverArrow class="fill-background stroke-border/50" />
    </PopoverContent>
  </PopoverRoot>
</template>

<script setup lang="ts">
import { PopoverArrow, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import PopoverContent from '@comfyorg/design-system/popover/PopoverContent'
import ToolboxButton from '@/components/graph/selectionToolbox/ToolboxButton.vue'
import { useAlignSelection } from '@/renderer/core/canvas/smartGuides/useAlignSelection'
import type { AlignAction } from '@comfyorg/graph-model/arrange/arrange'

const { t } = useI18n()

const { align, canAlign } = useAlignSelection()

interface AlignOption {
  action: AlignAction
  icon: string
  label: string
}

const alignOptionSections = {
  alignment: {
    horizontal: [
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
      }
    ],
    vertical: [
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
  },
  arrangement: {
    distribution: [
      {
        action: 'distributeX',
        label: 'g.distributeHorizontally',
        icon: 'icon-[lucide--align-horizontal-space-between]'
      },
      {
        action: 'distributeY',
        label: 'g.distributeVertically',
        icon: 'icon-[lucide--align-vertical-space-between]'
      }
    ],
    size: [
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
  }
} satisfies Record<string, Record<string, AlignOption[]>>

const alignOptionCount = Object.values(alignOptionSections).flatMap((groups) =>
  Object.values(groups).flat()
).length

function alignRowStyle(buttonCount: number) {
  const width = `calc(${buttonCount} * var(--spacing) * 8 + ${buttonCount - 1} * var(--spacing) + var(--spacing) * 4 + 2px)`
  return `flex-direction: if(style(--reka-popover-content-available-width < ${width}): column; else: row)`
}
</script>
