<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { PopoverTrigger } from 'reka-ui'

import { actionClass, panelClass, tip } from './menuBarStyles'
import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'

const { label, compact, icon } = defineProps<{
  label: string
  compact: boolean
  icon: string
}>()

const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Tooltip :config="tip(label)" side="bottom">
        <button
          :class="actionClass(false)"
          type="button"
          :aria-label="compact ? label : undefined"
        >
          <i :class="cn(icon, 'size-4')" />
          <span v-if="!compact">{{ label }}</span>
        </button>
      </Tooltip>
    </PopoverTrigger>
    <PopoverContent
      side="bottom"
      align="start"
      :side-offset="8"
      :class="cn(panelClass, 'w-56')"
    >
      <div class="flex flex-col gap-2 p-1">
        <slot />
      </div>
    </PopoverContent>
  </Popover>
</template>
