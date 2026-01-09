<script lang="ts" setup>
import { computed, watch } from 'vue'

import { cn } from '@/utils/tailwindUtil'

import TransitionCollapse from './TransitionCollapse.vue'

const props = defineProps<{
  isEmpty?: boolean
  defaultCollapse?: boolean
  label?: string
  enableEmptyState?: boolean
  noTooltip?: boolean
  tooltip?: string
}>()

const isCollapse = defineModel<boolean>('collapse', { default: false })

if (props.defaultCollapse) {
  isCollapse.value = true
}
watch(
  () => props.defaultCollapse,
  (value) => (isCollapse.value = value)
)

const isExpanded = computed(() => !isCollapse.value && !props.isEmpty)
</script>

<template>
  <div class="flex flex-col bg-comfy-menu-bg">
    <div
      class="sticky top-0 z-10 flex items-center justify-between backdrop-blur-xl bg-inherit"
    >
      <button
        v-tooltip="
          !noTooltip && (tooltip || isEmpty)
            ? {
                value: tooltip ?? $t('rightSidePanel.inputsNoneTooltip'),
                showDelay: 1_000
              }
            : undefined
        "
        type="button"
        :class="
          cn(
            'group min-h-12 bg-transparent border-0 outline-0 ring-0 w-full text-left flex items-center justify-between pl-4 pr-3',
            !isEmpty && 'cursor-pointer'
          )
        "
        :disabled="isEmpty"
        @click="isCollapse = !isCollapse"
      >
        <span class="text-sm font-semibold line-clamp-2 flex-1">
          <slot name="label">
            {{ label }}
          </slot>
        </span>

        <i
          :class="
            cn(
              'text-muted-foreground group-hover:text-base-foreground group-has-[.subbutton:hover]:text-muted-foreground group-focus:text-base-foreground icon-[lucide--chevron-up] size-4 transition-all',
              isCollapse && '-rotate-180',
              isEmpty && 'opacity-0'
            )
          "
        />
      </button>
    </div>
    <TransitionCollapse>
      <div v-if="isExpanded" class="pb-4">
        <slot />
      </div>
      <slot v-else-if="enableEmptyState && isEmpty" name="empty">
        <div>
          {{ $t('g.empty') }}
        </div>
      </slot>
    </TransitionCollapse>
  </div>
</template>
