<script setup lang="ts" generic="T extends WidgetValue">
import Button from 'primevue/button'
import { computed, defineAsyncComponent, ref } from 'vue'
import type { Component } from 'vue'

import type {
  ControlOptions,
  SimplifiedControlWidget,
  WidgetValue
} from '@/types/simplifiedWidget'

const ValueControlPopover = defineAsyncComponent(
  () => import('./ValueControlPopover.vue')
)

const props = defineProps<{
  widget: SimplifiedControlWidget<T>
  component: Component
}>()

const modelValue = defineModel<number>({ default: 0 })

const popover = ref()

const controlButtonIcon = computed(() => {
  switch (props.widget.controlWidget.value) {
    case 'increment':
      return 'pi pi-plus'
    case 'decrement':
      return 'pi pi-minus'
    case 'fixed':
      return 'icon-[lucide--pencil-off]'
    default:
      return 'icon-[lucide--shuffle]'
  }
})

const setControlMode = (mode: ControlOptions) => {
  props.widget.controlWidget.update(mode)
}

const togglePopover = (event: Event) => {
  popover.value.toggle(event)
}
</script>

<template>
  <div class="relative grid grid-cols-subgrid">
    <component :is="component" v-bind="$attrs" v-model="modelValue" :widget>
      <Button
        variant="link"
        size="small"
        class="h-4 w-7 self-center rounded-xl bg-blue-100/30 p-0"
        @pointerdown.stop.prevent="togglePopover"
      >
        <i :class="`${controlButtonIcon} text-blue-100 text-xs size-3.5`" />
      </Button>
    </component>
    <ValueControlPopover
      ref="popover"
      :control-mode="widget.controlWidget"
      @update:control-mode="setControlMode"
    />
  </div>
</template>
