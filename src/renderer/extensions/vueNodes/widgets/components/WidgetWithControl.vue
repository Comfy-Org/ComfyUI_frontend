<script setup lang="ts" generic="T extends WidgetValue">
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import type { Component } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import type {
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

const modelValue = defineModel<T>()

const popover = ref()

const controlModel = ref(props.widget.controlWidget.value)

const controlButtonIcon = computed(() => {
  switch (controlModel.value) {
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

watch(controlModel, props.widget.controlWidget.update)

const togglePopover = (event: Event) => {
  popover.value.toggle(event)
}
</script>

<template>
  <div class="relative grid grid-cols-subgrid">
    <component :is="component" v-bind="$attrs" v-model="modelValue" :widget>
      <Button
        variant="textonly"
        size="sm"
        class="h-4 w-7 self-center rounded-xl bg-blue-100/30 p-0"
        @pointerdown.stop.prevent="togglePopover"
      >
        <i :class="`${controlButtonIcon} text-blue-100 text-xs size-3.5`" />
      </Button>
    </component>
    <ValueControlPopover ref="popover" v-model="controlModel" />
  </div>
</template>
