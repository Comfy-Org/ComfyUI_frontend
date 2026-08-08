<script setup lang="ts">
import { DropdownMenuItem, DropdownMenuSeparator } from 'reka-ui'
import type { Component } from 'vue'

import Badge from '@/components/common/Badge.vue'
import OverlayIcon from '@/components/common/OverlayIcon.vue'
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
  <template
    v-for="(item, index) in items"
    :key="item.separator ? `separator-${index}` : item.id"
  >
    <component
      :is="separatorComponent"
      v-if="item.separator"
      class="my-1 w-full border-b border-border-subtle"
    />
    <component
      :is="itemComponent"
      v-else-if="item.visible !== false"
      :disabled="item.disabled"
      :class="
        cn(
          'flex min-h-6 items-center gap-2 self-stretch rounded-sm p-2 outline-none',
          !item.disabled && item.command && 'cursor-pointer',
          'data-highlighted:bg-secondary-background-hover',
          !item.disabled && 'hover:bg-secondary-background-hover',
          'data-disabled:cursor-default data-disabled:opacity-50'
        )
      "
      @select="() => item.command?.()"
    >
      <OverlayIcon v-if="item.overlayIcon" v-bind="item.overlayIcon" />
      <i v-else-if="item.icon" :class="item.icon" />
      <span class="flex-1">{{ item.label }}</span>
      <Badge
        v-if="item.badge"
        class="ml-3 h-5 px-1.5 text-2xs"
        :label="item.badge"
        :severity="item.badgeSeverity"
      />
    </component>
  </template>
</template>
