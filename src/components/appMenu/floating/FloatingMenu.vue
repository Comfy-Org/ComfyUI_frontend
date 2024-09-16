<template>
  <div class="floating-menu" ref="container"></div>
</template>

<script setup lang="ts">
import { app } from '@/scripts/app'
import { onMounted, ref } from 'vue'

const container = ref<HTMLDivElement | null>(null)

onMounted(() => {
  app.ui.setup(container.value)
})
</script>
