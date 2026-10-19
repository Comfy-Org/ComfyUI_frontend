<script setup lang="ts">
import {
  DropdownMenuLabel,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import type { DropdownMenuContentProps } from 'reka-ui'

import OverlayPortal from '@comfyorg/design-system/OverlayPortal'

import MenuContent from './MenuContent.vue'
import MenuItems from './MenuItems.vue'
import type { MenuItem } from './types'

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
</script>

<template>
  <DropdownMenuRoot v-model:open="open" :modal>
    <DropdownMenuTrigger as-child>
      <slot name="trigger" :open />
    </DropdownMenuTrigger>
    <OverlayPortal :open :to>
      <MenuContent
        :align
        :collision-padding
        :side
        :side-offset
        v-bind="$attrs"
        :class="$attrs.class"
      >
        <DropdownMenuLabel
          v-if="label"
          class="px-3 py-1.5 text-xs font-semibold text-muted-foreground"
        >
          {{ label }}
        </DropdownMenuLabel>
        <slot>
          <MenuItems :items @select="open = false">
            <template v-if="$slots.item" #item="slotProps">
              <slot name="item" v-bind="slotProps" />
            </template>
          </MenuItems>
        </slot>
      </MenuContent>
    </OverlayPortal>
  </DropdownMenuRoot>
</template>
