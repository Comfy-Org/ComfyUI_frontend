<script setup lang="ts">
import {
  AudioLines,
  Box,
  BrainCircuit,
  Expand,
  Image,
  LayoutGrid,
  MessageSquareText,
  Pencil,
  Video
} from '@lucide/vue'
import { computed, ref } from 'vue'

import HubFilterTabs from '../../ui/hub-filter-tabs/HubFilterTabs.vue'
import type { HubFilterTab } from '../../ui/hub-filter-tabs/HubFilterTabs.vue'

const { categories, label } = defineProps<{
  categories: string[]
  label: string
}>()

const selection = ref(categories[0] ?? '')
const categoryIcons = [
  LayoutGrid,
  Image,
  Video,
  AudioLines,
  Box,
  Pencil,
  Expand,
  MessageSquareText,
  BrainCircuit
]
const items = computed<HubFilterTab[]>(() =>
  categories.map((category, index) => ({
    icon: categoryIcons[index],
    label: category,
    value: category
  }))
)
</script>

<template>
  <nav :aria-label="label">
    <HubFilterTabs v-model="selection" :label :items />
  </nav>
</template>
