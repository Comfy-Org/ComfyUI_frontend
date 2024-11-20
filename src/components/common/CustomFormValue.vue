<template>
  <div ref="container"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

const props = defineProps<{
  renderFunction: () => HTMLElement
}>()

const container = ref<HTMLElement | null>(null)

function renderContent() {
  if (container.value) {
    container.value.innerHTML = ''
    const element = props.renderFunction()
    container.value.appendChild(element)
  }
}

onMounted(renderContent)

watch(() => props.renderFunction, renderContent)
</script>
