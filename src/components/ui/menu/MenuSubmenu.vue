<script setup lang="ts">
import { DropdownMenuSub, DropdownMenuPortal } from 'reka-ui'
import { computed, toValue } from 'vue'

import MenuRadioGroup from './MenuRadioGroup.vue'
import MenuSubContent from './MenuSubContent.vue'
import MenuSubTrigger from './MenuSubTrigger.vue'
import type { MenuItemRadioGroup, MenuItemSubmenu } from './types'

const { item } = defineProps<{
  item: MenuItemSubmenu | MenuItemRadioGroup
}>()

const disabled = computed(
  () =>
    toValue(item.disabled) ||
    (item.items ?? item.radioGroup.options).length === 0
)
</script>

<template>
  <DropdownMenuSub v-slot="{ open }">
    <MenuSubTrigger
      :aria-label="toValue(item.label)"
      :disabled
      :class="toValue(item.class)"
    >
      <slot />
    </MenuSubTrigger>
    <DropdownMenuPortal :key="Number(open)">
      <MenuSubContent :side-offset="2" :align-offset="-5">
        <slot v-if="item.items" name="content" :items="item.items" />
        <MenuRadioGroup
          v-else
          :model-value="toValue(item.radioGroup.value)"
          :options="item.radioGroup.options"
        />
      </MenuSubContent>
    </DropdownMenuPortal>
  </DropdownMenuSub>
</template>
