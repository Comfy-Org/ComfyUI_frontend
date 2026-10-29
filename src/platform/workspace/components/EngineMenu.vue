<template>
  <Menu
    v-model:open="open"
    :modal="false"
    :side-offset="8"
    :class="cn(switcherMenuWidthClass, switcherMenuMotionClass, menuClass)"
  >
    <template #trigger>
      <Button
        variant="secondary"
        size="unset"
        :disabled
        :tooltip
        tooltip-side="bottom"
        :aria-label="label"
        class="group h-8 gap-1 rounded-lg pr-1.5 pl-2 data-[state=open]:bg-accent"
        :data-testid="triggerTestid"
      >
        <slot name="icon" />
        <i
          class="icon-[lucide--chevron-down] size-3 text-muted-foreground transition-transform duration-150 group-data-[state=open]:rotate-180"
          aria-hidden="true"
        />
      </Button>
    </template>
    <slot />
  </Menu>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import Button from '@comfyorg/design-system/button/Button'
import Menu from '@comfyorg/design-system/menu/Menu'
import {
  switcherMenuMotionClass,
  switcherMenuWidthClass
} from '@/platform/workspace/components/deploymentSwitcherStyles'

const {
  label,
  tooltip,
  triggerTestid,
  disabled = false,
  menuClass
} = defineProps<{
  label: string
  tooltip: string
  triggerTestid: string
  disabled?: boolean
  menuClass?: string
}>()

const open = defineModel<boolean>('open', { default: false })
</script>
