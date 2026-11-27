<script setup lang="ts">
import { DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
import type { DropdownMenuContentProps } from 'reka-ui'

import MenuContent from './MenuContent.vue'
import MenuItems from './MenuItems.vue'
import MenuLabel from './MenuLabel.vue'
import type { MenuItem, MenuItemAction } from './types'

defineOptions({ inheritAttrs: false })

type MenuProps = {
  items?: MenuItem[]
  label?: string
  modal?: boolean
  to?: string | HTMLElement
} & Pick<
  DropdownMenuContentProps,
  'align' | 'collisionPadding' | 'side' | 'sideOffset'
>

const {
  align = 'start',
  collisionPadding,
  items = [],
  modal = true,
  side,
  sideOffset = 2
} = defineProps<MenuProps>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{ activate: [item: MenuItemAction] }>()
</script>

<template>
  <DropdownMenuRoot v-model:open="open" :modal>
    <DropdownMenuTrigger as-child>
      <slot name="trigger" :open />
    </DropdownMenuTrigger>
    <MenuContent
      :to
      :align
      :collision-padding
      :side
      :side-offset
      v-bind="$attrs"
      :class="$attrs.class"
    >
      <MenuLabel v-if="label">
        {{ label }}
      </MenuLabel>
      <slot>
        <MenuItems
          :items
          @select="open = false"
          @activate="emit('activate', $event)"
        >
          <template v-if="$slots.item" #item="slotProps">
            <slot name="item" v-bind="slotProps" />
          </template>
        </MenuItems>
      </slot>
    </MenuContent>
  </DropdownMenuRoot>
</template>
