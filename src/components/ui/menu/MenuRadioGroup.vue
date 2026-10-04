<script setup lang="ts" generic="T extends string">
import { DropdownMenuRadioGroup } from 'reka-ui'

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

function select(option: { value: T; command?: () => unknown }) {
  selected.value = option.value
  option.command?.()
}
</script>

<template>
  <DropdownMenuRadioGroup :model-value="selected">
    <MenuRadioItem
      v-for="option in options"
      :key="option.value"
      v-tooltip="{ value: option.tooltip, showDelay: 600 }"
      :value="option.value"
      @select="select(option)"
    >
      <MenuItemContent
        :item="{
          label: option.label,
          icon: option.icon,
          checked: selected === option.value
        }"
        :has-submenu="false"
      />
    </MenuRadioItem>
  </DropdownMenuRadioGroup>
</template>
