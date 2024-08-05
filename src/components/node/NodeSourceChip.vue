<template>
  <Chip :class="nodeSource.className">
    {{ nodeSource.displayText }}
  </Chip>
</template>

<script setup lang="ts">
import { getNodeSource } from '@/types/nodeSource'
import Chip from 'primevue/chip'
import { computed } from 'vue'

const props = defineProps({
  python_module: {
    type: String,
    required: true
  }
})

const nodeSource = computed(() => getNodeSource(props.python_module))
</script>

<style scoped>
.comfy-core,
.comfy-custom-nodes,
.comfy-unknown {
  font-size: small;
  font-weight: lighter;
}
</style>
