<script setup lang="ts">
import {
  ContextMenuContent,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuTrigger
} from 'reka-ui'

import { toValue } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import MenuItems from './MenuItems.vue'
import { menuContentClass } from './menuStyles'
import type { MenuItem } from './types'

defineOptions({ inheritAttrs: false })

const { id, model } = defineProps<{
  id?: string
  model: MenuItem[]
}>()

const open = defineModel<boolean>('open', { default: false })

function setOpen(value: boolean) {
  open.value = value && model.some((item) => toValue(item.visible) !== false)
}
</script>

<template>
  <ContextMenuRoot :open :modal="false" @update:open="setOpen">
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuPortal :key="Number(open)">
      <ContextMenuContent
        :id
        v-bind="$attrs"
        :class="
          cn(
            menuContentClass,
            'max-h-(--reka-context-menu-content-available-height)',
            $attrs.class
          )
        "
      >
        <MenuItems :items="model" @select="open = false">
          <template v-if="$slots.item" #item="slotProps">
            <slot name="item" v-bind="slotProps" />
          </template>
        </MenuItems>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
