<script setup lang="ts" generic="T extends string">
import { DropdownMenuRadioGroup } from 'reka-ui'

import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import TooltipContent from '@/components/ui/tooltip/TooltipContent.vue'
import TooltipTrigger from '@/components/ui/tooltip/TooltipTrigger.vue'

import MenuItemContent from './MenuItemContent.vue'
import MenuRadioItem from './MenuRadioItem.vue'

defineProps<{
  options: {
    value: T
    label: string
    icon?: string
    tooltip?: string
    command?: () => unknown
  }[]
}>()

const selected = defineModel<T>({ required: true })
const emit = defineEmits<{ select: [event: Event] }>()

function select(option: { value: T; command?: () => unknown }, event: Event) {
  selected.value = option.value
  option.command?.()
  emit('select', event)
}
</script>

<template>
  <DropdownMenuRadioGroup :model-value="selected">
    <Tooltip
      v-for="option in options"
      :key="option.value"
      :disabled="!option.tooltip"
    >
      <TooltipTrigger as-child>
        <MenuRadioItem :value="option.value" @select="select(option, $event)">
          <MenuItemContent
            :item="{
              label: option.label,
              icon: option.icon,
              checked: selected === option.value
            }"
            :has-submenu="false"
          />
        </MenuRadioItem>
      </TooltipTrigger>
      <TooltipContent side="right">{{ option.tooltip }}</TooltipContent>
    </Tooltip>
  </DropdownMenuRadioGroup>
</template>
