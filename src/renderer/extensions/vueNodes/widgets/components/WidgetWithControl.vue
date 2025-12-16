<script setup lang="ts" generic="T extends WidgetValue">
import Button from 'primevue/button'
import { computed, defineAsyncComponent, ref } from 'vue'

import type {
  ControlOptions,
  SafeControlWidget,
  SimplifiedWidget,
  WidgetValue
} from '@/types/simplifiedWidget'

const NumberControlPopover = defineAsyncComponent(
  () => import('./NumberControlPopover.vue')
)

const props = defineProps<{
  widget: SimplifiedWidget<T> & { controlWidget: SafeControlWidget }
  comp: unknown
}>()

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
  props.widget.controlWidget!.update(mode)
}

const togglePopover = (event: Event) => {
  popover.value.toggle(event)
}
</script>

<template>
  <component :is="comp" v-bind="$attrs" :widget>
    <Button
      variant="link"
      size="small"
      class="h-4 w-7 self-center rounded-xl bg-blue-100/30 p-0"
      @pointerdown.stop.prevent="togglePopover"
    >
      <i :class="`${controlButtonIcon} text-blue-100 text-xs size-3.5`" />
    </Button>
  </component>
  <NumberControlPopover
    ref="popover"
    :control-mode="widget.controlWidget"
    @update:control-mode="setControlMode"
  />
</template>
