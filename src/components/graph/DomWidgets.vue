<template>
  <div>
    <DomWidget v-for="widget in widgets" :key="widget.id" :widget="widget" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import DomWidget from '@/components/graph/widgets/DomWidget.vue'
import { DOMWidget } from '@/scripts/domWidget'
import { useDomWidgetStore } from '@/stores/domWidgetStore'

const domWidgetStore = useDomWidgetStore()
const widgets = computed(() =>
  Array.from(
    domWidgetStore.widgetInstances.values() as Iterable<
      DOMWidget<HTMLElement, object | string>
    >
  )
)
</script>
