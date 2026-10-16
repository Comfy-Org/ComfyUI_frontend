<template>
  <Menu
    v-model:open="open"
    :modal="false"
    :side-offset="8"
    :class="cn('max-w-100 min-w-56', switcherMenuMotionClass, menuClass)"
  >
    <template #trigger>
      <Button
        variant="secondary"
        size="unset"
        :disabled
        :tooltip
        tooltip-side="bottom"
        :aria-label="label"
        class="group h-8 gap-1 rounded-lg pr-1.5 pl-2 data-[state=open]:bg-secondary-background-hover"
        :data-testid="triggerTestid"
      >
        <slot name="icon" />
        <i
          class="icon-[lucide--chevron-down] size-3 shrink-0 text-muted-foreground transition-transform duration-150 group-data-[state=open]:rotate-180"
          aria-hidden="true"
        />
      </Button>
    </template>
    <slot />
  </Menu>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import Menu from '@/components/ui/menu/Menu.vue'
import { switcherMenuMotionClass } from '@/platform/workspace/components/deploymentSwitcherStyles'

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
