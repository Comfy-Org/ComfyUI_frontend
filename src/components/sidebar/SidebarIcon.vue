<template>
  <Button
    :class="props.class"
    text
    :pt="{
      root: {
        class: `side-bar-button ${
          props.selected
            ? 'p-button-primary side-bar-button-selected'
            : 'p-button-secondary'
        }`,
        'aria-label': props.tooltip
      }
    }"
    @click="emit('click', $event)"
    v-tooltip="{ value: props.tooltip, showDelay: 300, hideDelay: 300 }"
  >
    <template #icon>
      <OverlayBadge v-if="shouldShowBadge" :value="overlayValue">
        <i :class="props.icon + ' side-bar-button-icon'" />
      </OverlayBadge>
      <i v-else :class="props.icon + ' side-bar-button-icon'" />
    </template>
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import OverlayBadge from 'primevue/overlaybadge'
import { PropType, computed } from 'vue'

// Add this line to import PropsType

const props = defineProps({
  icon: String,
  selected: Boolean,
  tooltip: {
    type: String,
    default: ''
  },
  class: {
    type: String,
    default: ''
  },
  iconBadge: {
    type: [String, Function] as PropType<string | (() => string | null)>,
    default: ''
  }
})

const emit = defineEmits(['click'])
const overlayValue = computed(() =>
  typeof props.iconBadge === 'function'
    ? props.iconBadge() || ''
    : props.iconBadge
)
const shouldShowBadge = computed(() => !!overlayValue.value)
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
