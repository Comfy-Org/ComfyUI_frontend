<template>
  <div ref="widgetElement" />
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import type { DOMWidget } from '@/scripts/domWidget'

const { widget } = defineProps<{
  widget: DOMWidget<HTMLElement, any>
}>()

const widgetElement = ref<HTMLElement>()

onMounted(() => {
  widgetElement.value.appendChild(widget.element)
})
</script>
