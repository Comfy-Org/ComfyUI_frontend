<template>
  <Button
    :tooltip="computedTooltip"
    tooltip-side="right"
    :class="
      cn(
        'side-bar-button h-(--sidebar-item-height) w-(--sidebar-width) shrink-0 rounded-none p-2 text-xs',
        selected && 'side-bar-button-selected'
      )
    "
    variant="muted-textonly"
    size="unset"
    :aria-label="accessibleName"
    @click="emit('click', $event)"
    @contextmenu="emit('contextmenu', $event)"
  >
    <div class="side-bar-button-content flex flex-col items-center gap-2">
      <slot name="icon">
        <div class="sidebar-icon-wrapper relative">
          <i
            v-if="typeof icon === 'string'"
            class="side-bar-button-icon size-5"
            :class="icon"
          />
          <component
            :is="icon"
            v-else-if="typeof icon === 'object'"
            class="side-bar-button-icon"
          />
          <span
            v-if="shouldShowBadge"
            :class="
              cn(
                'sidebar-icon-badge absolute min-w-[16px] rounded-full bg-primary py-0.25 text-2xs leading-[14px] font-medium text-foreground',
                badgeClass || '-top-1 -right-1'
              )
            "
          >
            {{ overlayValue }}
          </span>
          <span
            v-if="provenanceBadge"
            class="sidebar-icon-provenance-badge absolute -bottom-1 -left-1 min-w-[16px] rounded-full bg-secondary py-0.25 text-2xs leading-[14px] font-medium text-foreground"
          >
            {{ provenanceBadge }}
          </span>
        </div>
      </slot>
      <!-- w-max sizes the label to the rail instead of the padding-inset
           button content box, which is too narrow for one-line labels -->
      <span
        v-if="label && !isSmall"
        class="side-bar-button-label line-clamp-2 w-max max-w-[calc(var(--sidebar-width)-var(--sidebar-padding))] text-center text-2xs leading-none wrap-break-word whitespace-normal"
        >{{ st(label, label) }}</span
      >
    </div>
  </Button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import { st } from '@/i18n'
import { cn } from '@comfyorg/tailwind-utils'

const {
  icon = '',
  selected = false,
  tooltip = '',
  tooltipSuffix = '',
  iconBadge = '',
  badgeClass = '',
  provenanceBadge = '',
  provenanceLabel = '',
  label = '',
  isSmall = false
} = defineProps<{
  icon?: string | Component
  selected?: boolean
  tooltip?: string
  tooltipSuffix?: string
  iconBadge?: string | (() => string | null)
  badgeClass?: string
  provenanceBadge?: string
  provenanceLabel?: string
  label?: string
  isSmall?: boolean
}>()

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
  (e: 'contextmenu', event: MouseEvent): void
}>()
const overlayValue = computed(() =>
  typeof iconBadge === 'function' ? (iconBadge() ?? '') : iconBadge
)
const shouldShowBadge = computed(() => !!overlayValue.value)
/**
 * Falls back to the label when no tooltip is provided, so labels clamped
 * to two lines can always be recovered in full on hover.
 */
const computedTooltip = computed(() => {
  const text = tooltip || label
  return st(text, text) + tooltipSuffix
})
const accessibleName = computed(() =>
  provenanceLabel
    ? `${computedTooltip.value} (${provenanceLabel})`
    : computedTooltip.value
)
</script>

<style>
.side-bar-button-icon {
  font-size: var(--sidebar-icon-size) !important;
}

.side-bar-button-selected {
  background-color: var(--muted);
  color: var(--foreground);
}
.side-bar-button:hover {
  background-color: var(--accent);
  color: var(--foreground);
}
</style>
