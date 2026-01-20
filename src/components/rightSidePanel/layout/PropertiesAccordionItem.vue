<script lang="ts" setup>
import { computed } from 'vue'

import { cn } from '@/utils/tailwindUtil'

import TransitionCollapse from './TransitionCollapse.vue'

const props = defineProps<{
  disabled?: boolean
  label?: string
  enableEmptyState?: boolean
  tooltip?: string
}>()

const isCollapse = defineModel<boolean>('collapse', { default: false })

const isExpanded = computed(() => !isCollapse.value && !props.disabled)

const tooltipConfig = computed(() => {
  if (!props.tooltip) return undefined
  return { value: props.tooltip, showDelay: 1000 }
})
</script>

<template>
  <div class="flex flex-col bg-comfy-menu-bg">
    <div
      class="sticky top-0 z-10 flex items-center justify-between bg-inherit backdrop-blur-xl"
    >
      <button
        v-tooltip="tooltipConfig"
        type="button"
        :class="
          cn(
            'group flex min-h-12 w-full items-center justify-between border-0 bg-transparent pr-3 pl-4 text-left ring-0 outline-0',
            !disabled && 'cursor-pointer'
          )
        "
        :disabled="disabled"
        @click="isCollapse = !isCollapse"
      >
        <span class="line-clamp-2 flex-1 text-sm font-semibold">
          <slot name="label">
            {{ label }}
          </slot>
        </span>

        <i
          :class="
            cn(
              'icon-[lucide--chevron-up] size-4 text-muted-foreground transition-all group-hover:text-base-foreground group-focus:text-base-foreground group-has-[.subbutton:hover]:text-muted-foreground',
              isCollapse && '-rotate-180',
              disabled && 'opacity-0'
            )
          "
        />
      </button>
    </div>
    <TransitionCollapse>
      <div
        v-if="isExpanded"
        class="pb-4"
      >
        <slot />
      </div>
      <slot
        v-else-if="enableEmptyState && disabled"
        name="empty"
      >
        <div>
          {{ $t('g.empty') }}
        </div>
      </slot>
    </TransitionCollapse>
  </div>
</template>
