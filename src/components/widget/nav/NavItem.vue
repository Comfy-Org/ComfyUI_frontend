<template>
  <Tooltip
    :config="{
      value: tooltipText,
      disabled: !isOverflowing
    }"
    content-class="w-max whitespace-nowrap"
    side="right"
  >
    <div
      class="flex cursor-pointer items-center-safe gap-2 rounded-md px-4 py-3 text-sm text-base-foreground transition-colors select-none"
      :class="
        active
          ? 'bg-interface-menu-component-surface-selected'
          : 'hover:bg-interface-menu-component-surface-hovered'
      "
      role="button"
      @mouseenter="checkOverflow"
      @click="onClick"
    >
      <NavIcon v-if="icon" :icon="icon" />
      <i v-else class="text-neutral icon-[lucide--folder] shrink-0 text-xs" />
      <span ref="textRef" class="min-w-0 truncate">
        <slot />
      </span>
      <StatusBadge
        v-if="badge !== undefined"
        :label="String(badge)"
        severity="contrast"
        variant="circle"
        class="ml-auto min-h-5 min-w-5 px-1 text-base-background"
      />
      <i
        v-else-if="suffixIcon"
        :class="cn('ml-auto size-4 shrink-0', suffixIcon)"
        aria-hidden="true"
      />
    </div>
  </Tooltip>
</template>

<script setup lang="ts">
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'

import { computed, ref } from 'vue'

import StatusBadge from '@/components/common/StatusBadge.vue'
import type { NavItemData } from '@/types/navTypes'
import { cn } from '@comfyorg/tailwind-utils'

import NavIcon from './NavIcon.vue'

const { icon, badge, suffixIcon, active, onClick } = defineProps<{
  icon: NavItemData['icon']
  badge?: NavItemData['badge']
  suffixIcon?: NavItemData['suffixIcon']
  active?: boolean
  onClick: () => void
}>()

const textRef = ref<HTMLElement | null>(null)
const isOverflowing = ref(false)

const checkOverflow = () => {
  if (!textRef.value) return
  isOverflowing.value =
    textRef.value.scrollWidth > textRef.value.clientWidth + 1
}

const tooltipText = computed(() => textRef.value?.textContent ?? '')
</script>
