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
    class="w-10 h-10 bg-zinc-900/50"
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
import OverlayBadge from 'primevue/overlaybadge'
import Button from 'primevue/button'
import { computed, PropType } from 'vue' // Add this line to import PropsType

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
