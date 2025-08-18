<template>
  <Button
    v-tooltip="{
      value: computedTooltip,
      showDelay: 300,
      hideDelay: 300
    }"
    text
    :pt="{
      root: {
        class: `side-bar-button ${
          selected
            ? 'p-button-primary side-bar-button-selected'
            : 'p-button-secondary'
        }`,
        'aria-label': computedTooltip
      }
    }"
    @click="emit('click', $event)"
  >
    <template #icon>
      <div class="side-bar-button-content">
        <slot name="icon">
          <OverlayBadge v-if="shouldShowBadge" :value="overlayValue">
            <i
              v-if="typeof icon === 'string'"
              :class="icon + ' side-bar-button-icon'"
            />
            <component :is="icon" v-else class="side-bar-button-icon" />
          </OverlayBadge>
          <i
            v-else-if="typeof icon === 'string'"
            :class="icon + ' side-bar-button-icon'"
          />
          <component
            :is="icon"
            v-else-if="typeof icon === 'object'"
            class="side-bar-button-icon"
          />
        </slot>
        <span v-if="label && !isSmall" class="side-bar-button-label">{{
          t(label)
        }}</span>
      </div>
    </template>
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import OverlayBadge from 'primevue/overlaybadge'
import { computed } from 'vue'
import type { Component } from 'vue'
import { useI18n } from 'vue-i18n'

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
  typeof iconBadge === 'function' ? iconBadge() ?? '' : iconBadge
)
const shouldShowBadge = computed(() => !!overlayValue.value)
const computedTooltip = computed(() => t(tooltip) + tooltipSuffix)
</script>

<style>
.side-bar-button-icon {
  font-size: var(--sidebar-icon-size) !important;
}

.side-bar-button-selected .side-bar-button-icon {
  font-size: var(--sidebar-icon-size) !important;
  font-weight: bold;
}
</style>

<style scoped>
.side-bar-button {
  width: var(--sidebar-width);
  height: calc(var(--sidebar-width) + 0.5rem);
  border-radius: 0;
}

.side-tool-bar-end .side-bar-button {
  height: var(--sidebar-width);
}

.side-bar-button-content {
  @apply flex flex-col items-center gap-2;
}

.side-bar-button-label {
  @apply text-[10px] text-center whitespace-nowrap;
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
