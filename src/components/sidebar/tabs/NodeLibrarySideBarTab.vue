<template>
  <Tree :value="root.children"></Tree>
</template>

<script setup lang="ts">
import Tree from 'primevue/tree'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { computed } from 'vue'

const root = computed(() => useNodeDefStore().nodeTree)
</script>
