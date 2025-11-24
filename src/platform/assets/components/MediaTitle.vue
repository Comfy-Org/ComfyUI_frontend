<template>
  <h3
    class="m-0 line-clamp-1 text-sm font-bold text-base-foreground"
    :title="fullName"
  >
    {{ displayName }}
  </h3>
</template>

<script setup lang="ts">
import { truncateFilename } from '@comfyorg/shared-frontend-utils/formatUtil'
import { computed } from 'vue'

const props = defineProps<{
  fileName: string
}>()

const fullName = computed(() => props.fileName)
const displayName = computed(() => truncateFilename(props.fileName))
</script>
