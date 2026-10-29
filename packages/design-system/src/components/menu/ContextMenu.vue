<script setup lang="ts">
import { ContextMenuRoot, ContextMenuTrigger } from 'reka-ui'
import { toValue } from 'vue'

import ContextMenuContent from './ContextMenuContent.vue'
import MenuItems from './MenuItems.vue'
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
    <ContextMenuContent
      :id
      v-bind="$attrs"
      class="max-h-(--reka-context-menu-content-available-height)"
    >
      <MenuItems :items="model" @select="open = false">
        <template v-if="$slots.item" #item="slotProps">
          <slot name="item" v-bind="slotProps" />
        </template>
      </MenuItems>
    </ContextMenuContent>
  </ContextMenuRoot>
</template>
