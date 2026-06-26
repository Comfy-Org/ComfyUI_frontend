<script setup lang="ts">
import type { Component } from 'vue'

import OverlayIcon from '@/components/common/OverlayIcon.vue'
import DropdownMenuItem from '@/components/ui/dropdown-menu/DropdownMenuItem.vue'
import DropdownMenuSeparator from '@/components/ui/dropdown-menu/DropdownMenuSeparator.vue'
import type { WorkflowMenuItem } from '@/types/workflowMenuItem'

const {
  items,
  itemComponent = DropdownMenuItem,
  separatorComponent = DropdownMenuSeparator
} = defineProps<{
  items: WorkflowMenuItem[]
  itemComponent?: Component
  separatorComponent?: Component
}>()
</script>

<template>
  <template v-for="(item, index) in items" :key="index">
    <component :is="separatorComponent" v-if="item.separator" />
    <component
      :is="itemComponent"
      v-else-if="item.visible !== false"
      :disabled="item.disabled"
      @select="() => item.command?.()"
    >
      <template v-if="item.overlayIcon || item.icon" #icon>
        <OverlayIcon v-if="item.overlayIcon" v-bind="item.overlayIcon" />
        <i v-else-if="item.icon" :class="item.icon" />
      </template>
      <span class="flex-1 truncate">{{ item.label }}</span>
      <span
        v-if="item.badge"
        class="ml-3 flex items-center gap-1 rounded-full bg-(--primary-background) px-1.5 py-0.5 text-2xs text-base-foreground uppercase"
      >
        {{ item.badge }}
      </span>
    </component>
  </template>
</template>
