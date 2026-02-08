<template>
  <div ref="container" />
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

const { renderFunction } = defineProps<{
  renderFunction: () => HTMLElement
}>()

const container = ref<HTMLElement | null>(null)

function renderContent() {
  if (container.value) {
    container.value.innerHTML = ''
    const element = renderFunction()
    container.value.appendChild(element)
  }
}

onMounted(renderContent)

watch(() => renderFunction, renderContent)
</script>
