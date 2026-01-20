<template>
  <Button
    v-tooltip="{
      value: computedTooltip,
      showDelay: 300,
      hideDelay: 300
    }"
    :class="
      cn(
        'side-bar-button cursor-pointer border-none',
        selected && 'side-bar-button-selected'
      )
    "
    variant="muted-textonly"
    :aria-label="computedTooltip"
    @click="emit('click', $event)"
  >
    <div class="side-bar-button-content">
      <slot name="icon">
        <div class="sidebar-icon-wrapper relative">
          <i v-if="typeof icon === 'string'" :class="icon" />
          <component :is="icon" v-else-if="typeof icon === 'object'" />
          <span
            v-if="shouldShowBadge"
            class="absolute -top-2 -right-2 min-w-[16px] rounded-full bg-primary-background py-0.25 text-[10px] font-medium leading-[14px] text-base-foreground">
            {{ overlayValue }}
          </span>
        </div>
      </slot>
      <span v-if="label && !isSmall" class="side-bar-button-label">{{
        t(label)
      }}</span>
    </div>
  </Button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { cn } from '@/utils/tailwindUtil'

const { t } = useI18n()
const {
  icon = '',
  selected = false,
  tooltip = '',
  tooltipSuffix = '',
  iconBadge = '',
  label = '',
  isSmall = false
} = defineProps<{
  icon?: string | Component
  selected?: boolean
  tooltip?: string
  tooltipSuffix?: string
  iconBadge?: string | (() => string | null)
  label?: string
  isSmall?: boolean
}>()

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()
const overlayValue = computed(() =>
  typeof iconBadge === 'function' ? (iconBadge() ?? '') : iconBadge
)
const shouldShowBadge = computed(() => !!overlayValue.value)
const computedTooltip = computed(() => t(tooltip) + tooltipSuffix)
</script>

<style>
.sidebar-icon-wrapper > i,
.sidebar-icon-wrapper > svg {
  font-size: var(--sidebar-icon-size);
}

.side-bar-button-selected {
  background-color: var(--interface-panel-selected-surface);
  color: var(--content-hover-fg);
}
.side-bar-button:hover {
  background-color: var(--interface-panel-hover-surface);
  color: var(--content-hover-fg);
}
</style>

<style scoped>
@reference '../../assets/css/style.css';

.side-bar-button {
  width: var(--sidebar-width);
  height: var(--sidebar-item-height);
  border-radius: 0;
  flex-shrink: 0;
}

.side-tool-bar-end .side-bar-button {
  height: var(--sidebar-width);
}

.side-bar-button-content {
  @apply flex flex-col items-center gap-2;
}

.side-bar-button-label {
  @apply text-[10px] text-center;
  line-height: 1;
}

.comfyui-body-left .side-bar-button.side-bar-button-selected,
.comfyui-body-left .side-bar-button.side-bar-button-selected:hover {
  border-left: 4px solid var(--p-button-text-primary-color);
}

.comfyui-body-right .side-bar-button.side-bar-button-selected,
.comfyui-body-right .side-bar-button.side-bar-button-selected:hover {
  border-right: 4px solid var(--p-button-text-primary-color);
}
</style>
