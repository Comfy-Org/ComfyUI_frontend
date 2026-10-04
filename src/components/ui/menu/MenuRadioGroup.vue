<script setup lang="ts" generic="T extends string">
import { DropdownMenuRadioGroup, DropdownMenuRadioItem } from 'reka-ui'

import MenuItemContent from './MenuItemContent.vue'
import { menuItemClass } from './menuStyles'

defineProps<{
  options: { value: T; label: string; icon?: string }[]
}>()

const selected = defineModel<T>({ required: true })
</script>

<template>
  <DropdownMenuRadioGroup :model-value="selected">
    <DropdownMenuRadioItem
      v-for="option in options"
      :key="option.value"
      :value="option.value"
      :class="menuItemClass"
      @select="selected = option.value"
    >
      <MenuItemContent
        :item="{
          label: option.label,
          icon: option.icon,
          checked: selected === option.value
        }"
        :has-submenu="false"
      />
    </DropdownMenuRadioItem>
  </DropdownMenuRadioGroup>
</template>
