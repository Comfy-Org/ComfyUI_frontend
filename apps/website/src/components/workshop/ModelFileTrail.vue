<script setup lang="ts">
import DetailTrail from './DetailTrail.vue'

const { name } = defineProps<{ name: string }>()
</script>

<template>
  <div
    class="mx-auto max-w-7xl px-6 pt-10 lg:px-8"
    data-testid="model-file-trail"
  >
    <DetailTrail section="models" :name />
  </div>
</template>
