<script lang="ts" setup>
import { computed } from 'vue'

import Tooltip from '@comfyorg/design-system/tooltip/Tooltip'
import TooltipContent from '@comfyorg/design-system/tooltip/TooltipContent'
import TooltipTrigger from '@comfyorg/design-system/tooltip/TooltipTrigger'
import { cn } from '@comfyorg/tailwind-utils'

import TransitionCollapse from '@comfyorg/design-system/transition/TransitionCollapse'

const {
  disabled,
  label,
  enableEmptyState,
  tooltip,
  size = 'default',
  variant = 'default',
  class: className
} = defineProps<{
  disabled?: boolean
  label?: string
  enableEmptyState?: boolean
  tooltip?: string
  size?: 'default' | 'lg'
  variant?: 'default' | 'card'
  class?: string
}>()

const isCollapse = defineModel<boolean>('collapse', { default: false })

const isExpanded = computed(() => !isCollapse.value && !disabled)
</script>

<template>
  <div
    :class="
      cn(
        'flex flex-col bg-background',
        variant === 'card' && 'border-t bg-card',
        className
      )
    "
  >
    <div
      class="sticky top-0 z-10 flex items-center justify-between bg-inherit backdrop-blur-xl"
    >
      <Tooltip :disabled="!tooltip">
        <TooltipTrigger as-child>
          <div class="w-full" :tabindex="disabled && tooltip ? 0 : undefined">
            <button
              type="button"
              :class="
                cn(
                  'group flex w-full items-center justify-between border-0 bg-transparent pr-3 pl-4 text-left ring-0 outline-0 disabled:text-muted-foreground',
                  size === 'lg' ? 'min-h-16' : 'min-h-12',
                  !disabled && 'cursor-pointer'
                )
              "
              :disabled="disabled"
              @click="isCollapse = !isCollapse"
            >
              <span
                :class="
                  cn(
                    'line-clamp-2 flex-1 font-semibold',
                    variant === 'card'
                      ? 'text-xs uppercase select-none'
                      : 'text-sm'
                  )
                "
              >
                <slot name="label">
                  {{ label }}
                </slot>
              </span>

              <i
                :class="
                  cn(
                    'icon-[lucide--chevron-up] text-muted-foreground transition-all group-hover:text-foreground group-focus:text-foreground group-has-[.subbutton:hover]:text-muted-foreground',
                    isCollapse && '-rotate-180',
                    disabled && 'opacity-0'
                  )
                "
              />
            </button>
          </div>
        </TooltipTrigger>
        <TooltipContent>{{ tooltip }}</TooltipContent>
      </Tooltip>
    </div>
    <TransitionCollapse>
      <div v-if="isExpanded" class="pb-4">
        <slot />
      </div>
      <slot v-else-if="enableEmptyState && disabled" name="empty">
        <div>
          {{ $t('g.empty') }}
        </div>
      </slot>
    </TransitionCollapse>
  </div>
</template>
