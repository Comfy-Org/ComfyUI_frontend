<script setup lang="ts">
import { DropdownMenuItem, DropdownMenuSeparator } from 'reka-ui'
import type { Component } from 'vue'

import OverlayIcon from '@/components/common/OverlayIcon.vue'
import { menuItemClass } from '@/components/ui/menu/menuStyles'
import type { WorkflowMenuItem } from '@/types/workflowMenuItem'
import { cn } from '@comfyorg/tailwind-utils'

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
    <component
      :is="separatorComponent"
      v-if="item.separator"
      class="my-1 h-px bg-border-subtle"
    />
    <component
      :is="itemComponent"
      v-else-if="item.visible !== false"
      :disabled="item.disabled"
      :class="menuItemClass"
      @select="() => item.command?.()"
    >
      <OverlayIcon v-if="item.overlayIcon" v-bind="item.overlayIcon" />
      <i v-else-if="item.icon" :class="cn(item.icon, 'size-4 shrink-0')" />
      <span class="flex-1">{{ item.label }}</span>
      <span
        v-if="item.badge"
        class="ml-3 flex items-center gap-1 rounded-full bg-(--primary-background) px-1.5 py-0.5 text-2xs text-base-foreground uppercase"
      >
        {{ item.badge }}
      </span>
    </component>
  </template>
</template>
