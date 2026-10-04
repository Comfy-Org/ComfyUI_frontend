<script setup lang="ts">
import { DropdownMenuPortal, DropdownMenuSub } from 'reka-ui'
import { computed, toValue } from 'vue'
import type { Slot } from 'vue'

import MenuItems from './MenuItems.vue'
import MenuRadioGroup from './MenuRadioGroup.vue'
import MenuSubContent from './MenuSubContent.vue'
import MenuSubTrigger from './MenuSubTrigger.vue'
import type {
  MenuItemRadioGroup,
  MenuItemSlotProps,
  MenuItemSubmenu
} from './types'

const { item, itemContent, ownerId } = defineProps<{
  item: MenuItemSubmenu | MenuItemRadioGroup
  itemContent?: Slot<MenuItemSlotProps>
  ownerId?: string
}>()

const emit = defineEmits<{ select: [] }>()
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
    <DropdownMenuPortal>
      <MenuSubContent
        :open
        :data-menu-owner="ownerId"
        :side-offset="2"
        :align-offset="-5"
      >
        <MenuItems
          v-if="item.items"
          :items="item.items"
          :item-content
          :owner-id
          @select="emit('select')"
        />
        <MenuRadioGroup
          v-else
          :model-value="toValue(item.radioGroup.value)"
          :options="item.radioGroup.options"
        />
      </MenuSubContent>
    </DropdownMenuPortal>
  </DropdownMenuSub>
</template>
