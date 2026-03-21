<template>
  <div :class="panelClass">
    <template v-for="entry in entries" :key="entry.key">
      <component
        :is="separatorComponent"
        v-if="entry.kind === 'divider'"
        :class="separatorWrapperClass"
      >
        <div :class="separatorClass" />
      </component>
      <component
        :is="itemComponent"
        v-else
        as-child
        :disabled="entry.disabled"
        :text-value="entry.label"
        @select="emit('action', entry)"
      >
        <Button
          :variant="buttonVariant"
          :size="buttonSize"
          :class="buttonClass"
          :disabled="entry.disabled"
        >
          <i v-if="entry.icon" :class="cn(entry.icon, iconClass)" />
          <span :class="labelClass">{{ entry.label }}</span>
        </Button>
      </component>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'

import type { ButtonVariants } from '@/components/ui/button/button.variants'
import Button from '@/components/ui/button/Button.vue'
import type { MenuActionEntry, MenuEntry } from '@/types/menuTypes'
import { cn } from '@/utils/tailwindUtil'

const {
  entries,
  itemComponent,
  separatorComponent,
  panelClass,
  separatorWrapperClass,
  separatorClass,
  buttonClass,
  iconClass,
  labelClass,
  buttonVariant = 'secondary',
  buttonSize = 'sm'
} = defineProps<{
  entries: MenuEntry[]
  itemComponent: Component
  separatorComponent: Component
  panelClass: string
  separatorWrapperClass: string
  separatorClass: string
  buttonClass: string
  iconClass: string
  labelClass?: string
  buttonVariant?: ButtonVariants['variant']
  buttonSize?: ButtonVariants['size']
}>()

const emit = defineEmits<{
  action: [entry: MenuActionEntry]
}>()
</script>
