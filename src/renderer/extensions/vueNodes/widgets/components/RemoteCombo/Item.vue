<script setup lang="ts">
import { ComboboxItem, ComboboxItemIndicator } from 'reka-ui'
import { computed, inject } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { DropdownItemShape } from '@/base/remote/itemSchema'

import { itemVariants } from './remoteCombo.variants'
import type { ItemVariants } from './remoteCombo.variants'
import { RemoteComboKey } from './state'

const props = defineProps<{
  item: DropdownItemShape
  index: number
  layout?: ItemVariants['layout']
  class?: string
}>()

const ctx = inject(RemoteComboKey)
if (!ctx) {
  throw new Error('RemoteCombo.Item must be used inside RemoteCombo.Root')
}

const isSelected = computed(() => ctx.selectedValue.value === props.item.id)
</script>

<template>
  <ComboboxItem
    :value="item.id"
    :class="cn(itemVariants({ layout: props.layout }), props.class)"
    :data-testid="`remote-combo-item-${index}`"
    @select="ctx.select(item.id)"
  >
    <slot :item="item" :index="index" :is-selected="isSelected">
      <div class="flex flex-1 flex-col gap-0.5 overflow-hidden">
        <span class="truncate">{{ item.name }}</span>
        <span
          v-if="item.description"
          class="truncate text-[10px] text-muted-foreground"
        >
          {{ item.description }}
        </span>
      </div>
    </slot>
    <ComboboxItemIndicator>
      <i
        class="icon-[lucide--check] size-4 text-primary-background"
        aria-hidden="true"
      />
    </ComboboxItemIndicator>
  </ComboboxItem>
</template>
