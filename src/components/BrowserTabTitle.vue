<template>
  <div>
    <!-- This component does not render anything visible. -->
  </div>
</template>

<script setup lang="ts">
import { useExecutionStore } from '@/stores/executionStore'
import { useTitle } from '@vueuse/core'
import { computed } from 'vue'

const executionStore = useExecutionStore()
const executionText = computed(() =>
  executionStore.isIdle ? '' : `[${executionStore.executionProgress}%]`
)
const title = computed(() => executionText.value + 'ComfyUI')
useTitle(title)
</script>
