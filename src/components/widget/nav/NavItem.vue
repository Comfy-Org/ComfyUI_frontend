<template>
  <div
    v-tooltip.right="{
      value: tooltipText,
      disabled: !isOverflowing,
      pt: { text: { class: 'w-max whitespace-nowrap' } }
    }"
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
    <Badge
      v-if="badge !== undefined"
      :label="String(badge)"
      severity="contrast"
      variant="circle"
      class="ml-auto min-h-5 min-w-5 px-1 text-base-background"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import Badge from '@/components/common/Badge.vue'
import type { NavItemData } from '@/types/navTypes'

import NavIcon from './NavIcon.vue'

const { icon, badge, active, onClick } = defineProps<{
  icon: NavItemData['icon']
  badge?: NavItemData['badge']
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
