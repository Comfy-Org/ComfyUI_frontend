<script setup lang="ts">
import {
  AudioLines,
  Box,
  BrainCircuit,
  Expand,
  Handshake,
  Image,
  LayoutGrid,
  MessageSquareText,
  PackageOpen,
  Pencil,
  Video
} from '@lucide/vue'
import { computed } from 'vue'
import type { Component } from 'vue'

import HubFilterTabs from '../../ui/hub-filter-tabs/HubFilterTabs.vue'
import type { HubFilterTab } from '../../ui/hub-filter-tabs/HubFilterTabs.vue'
import type { ModelCategory } from '../../../config/modelCategories'
import type { ModelAccessFilter } from './modelExploreCatalog'

export type ModelCatalogFilterValue =
  | 'all'
  | ModelCategory
  | Exclude<ModelAccessFilter, 'all'>

export interface ModelCategoryOption {
  label: string
  value: ModelCatalogFilterValue
}

const { categories, label } = defineProps<{
  categories: ModelCategoryOption[]
  label: string
}>()

const selection = defineModel<ModelCatalogFilterValue>({ default: 'all' })
const categoryIcons: Readonly<
  Partial<Record<ModelCatalogFilterValue, Component>>
> = {
  all: LayoutGrid,
  image: Image,
  video: Video,
  audio: AudioLines,
  '3d': Box,
  edit: Pencil,
  upscale: Expand,
  llm: MessageSquareText,
  train: BrainCircuit,
  open: PackageOpen,
  partner: Handshake
}
const items = computed<HubFilterTab[]>(() =>
  categories.map((category) => ({
    icon: categoryIcons[category.value],
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
