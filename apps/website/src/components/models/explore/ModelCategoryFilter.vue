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
import { computed } from 'vue'

import HubFilterTabs from '../../ui/hub-filter-tabs/HubFilterTabs.vue'
import type { HubFilterTab } from '../../ui/hub-filter-tabs/HubFilterTabs.vue'
import type { ModelCategory } from '../../../config/modelCategories'

export interface ModelCategoryOption {
  label: string
  value: 'all' | ModelCategory
}

const { categories, label } = defineProps<{
  categories: ModelCategoryOption[]
  label: string
}>()

const selection = defineModel<'all' | ModelCategory>({ default: 'all' })
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
    label: category.label,
    value: category.value
  }))
)
</script>

<template>
  <nav :aria-label="label">
    <HubFilterTabs v-model="selection" :label :items />
  </nav>
</template>
