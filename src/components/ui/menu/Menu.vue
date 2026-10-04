<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'

import { cn } from '@comfyorg/tailwind-utils'

import { useModalLiftedZIndex } from '@/composables/useModalLiftedZIndex'

import MenuItems from './MenuItems.vue'
import { menuContentClass } from './menuStyles'
import type { MenuItem } from './types'

defineOptions({ inheritAttrs: false })

const { items = [], modal = true } = defineProps<{
  items?: MenuItem[]
  label?: string
  modal?: boolean
  to?: string | HTMLElement
}>()

const open = defineModel<boolean>('open', { default: false })
const contentStyle = useModalLiftedZIndex(open)
</script>

<template>
  <DropdownMenuRoot v-model:open="open" :modal>
    <DropdownMenuTrigger as-child>
      <slot name="trigger" :open />
    </DropdownMenuTrigger>
    <DropdownMenuPortal :to>
      <DropdownMenuContent
        :side-offset="2"
        align="start"
        v-bind="$attrs"
        :class="
          cn(
            menuContentClass,
            'max-h-(--reka-dropdown-menu-content-available-height)',
            $attrs.class
          )
        "
        :style="contentStyle"
      >
        <DropdownMenuLabel
          v-if="label"
          class="px-3 py-1.5 text-xs font-semibold text-muted-foreground"
        >
          {{ label }}
        </DropdownMenuLabel>
        <slot :content-style>
          <MenuItems :items :content-style @select="open = false">
            <template v-if="$slots.item" #item="slotProps">
              <slot name="item" v-bind="slotProps" />
            </template>
          </MenuItems>
        </slot>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
