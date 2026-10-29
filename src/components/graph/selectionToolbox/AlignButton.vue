<template>
  <PopoverRoot v-model:open="isOpen">
    <PopoverTrigger as-child>
      <Button
        :tooltip="t('g.alignAndDistribute')"
        :variant="isOpen ? 'secondary' : 'muted-textonly'"
        :aria-label="t('g.alignAndDistribute')"
        :disabled="!canArrange"
      >
        <div class="flex items-center gap-1">
          <i :class="ARRANGE_ICON" />
          <i class="icon-[lucide--chevron-down]" />
        </div>
      </Button>
    </PopoverTrigger>
    <SelectionToolboxBar
      :open="isOpen"
      keep-open-for="[data-selection-toolbox]"
    >
      <div
        role="group"
        :aria-label="t('g.alignAndDistribute')"
        class="flex h-8 items-center gap-1"
      >
        <Button
          v-for="option in alignOptions"
          :key="option.name"
          :tooltip="option.localizedName"
          tooltip-side="bottom"
          variant="muted-textonly"
          :aria-label="option.localizedName"
          :disabled="!canArrange"
          @click="applyAlign(option)"
        >
          <i :class="option.icon" />
        </Button>
        <VerticalDivider />
        <Button
          v-for="option in distributeOptions"
          :key="option.name"
          :tooltip="option.localizedName"
          tooltip-side="bottom"
          variant="muted-textonly"
          :aria-label="option.localizedName"
          :disabled="!canArrange"
          @click="applyDistribute(option)"
        >
          <i :class="option.icon" />
        </Button>
      </div>
    </SelectionToolboxBar>
  </PopoverRoot>
</template>

<script setup lang="ts">
import { PopoverRoot, PopoverTrigger } from 'reka-ui'
import { onBeforeUnmount, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import VerticalDivider from '@comfyorg/design-system/common/VerticalDivider'
import SelectionToolboxBar from '@/components/graph/selectionToolbox/SelectionToolboxBar.vue'
import {
  LIFT_WHILE_OPEN,
  hasSameMembers
} from '@/components/graph/selectionToolbox/selectionToolboxBar'
import {
  ARRANGE_ICON,
  useNodeArrangement
} from '@/composables/graph/useNodeArrangement'
import { useSelectionState } from '@/composables/graph/useSelectionState'

const { t } = useI18n()
const {
  canArrange,
  alignOptions,
  distributeOptions,
  applyAlign,
  applyDistribute
} = useNodeArrangement()
const { selectedNodes } = useSelectionState()
const lift = defineModel<number>('lift', { default: 0 })

const isOpen = defineModel<boolean>('open', { default: false })

watch(isOpen, (open) => {
  lift.value = open ? LIFT_WHILE_OPEN : 0
})

watch(selectedNodes, (nodes, previous) => {
  if (!hasSameMembers(nodes, previous)) isOpen.value = false
})

onBeforeUnmount(() => {
  isOpen.value = false
  lift.value = 0
})
</script>
