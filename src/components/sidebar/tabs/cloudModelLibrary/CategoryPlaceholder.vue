<script setup lang="ts">
import { computed } from 'vue'

import { placeholderGradientForCategory } from '@/composables/sidebarTabs/useCategoryPlaceholder'

const { category } = defineProps<{ category: string }>()
const background = computed(() => placeholderGradientForCategory(category))
</script>

<template>
  <div class="size-full" :style="{ background }" />
</template>
