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
      <OverlayBadge v-if="shouldShowBadge" :value="overlayValue">
        <i :class="icon + ' side-bar-button-icon'" />
      </OverlayBadge>
      <i v-else :class="icon + ' side-bar-button-icon'" />
    </template>
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import OverlayBadge from 'primevue/overlaybadge'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const {
  icon = '',
  selected = false,
  tooltip = '',
  tooltipSuffix = '',
  iconBadge = ''
} = defineProps<{
  icon?: string
  selected?: boolean
  tooltip?: string
  tooltipSuffix?: string
  iconBadge?: string | (() => string | null)
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
  height: var(--sidebar-width);
  border-radius: 0;
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
