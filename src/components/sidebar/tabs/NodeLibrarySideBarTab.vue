<template>
  <Tree :value="root.children" :filter="true" filterMode="lenient"></Tree>
</template>

<script setup lang="ts">
import Tree from 'primevue/tree'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { computed } from 'vue'

const root = computed(() => useNodeDefStore().nodeTree)
</script>
