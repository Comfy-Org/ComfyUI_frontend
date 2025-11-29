<script setup lang="ts">
import { ref } from 'vue'
import { SidebarTreeCategory, SidebarGridCard } from '@/components/common/sidebar'
import { MODEL_CATEGORIES_DATA, type ModelCategory } from '@/data/sidebarMockData'

defineProps<{
  viewMode: 'list' | 'grid'
}>()

const modelCategories = ref<ModelCategory[]>(
  MODEL_CATEGORIES_DATA.map(c => ({ ...c }))
)

function toggleCategory(categoryId: string): void {
  const category = modelCategories.value.find(c => c.id === categoryId)
  if (category) {
    category.expanded = !category.expanded
  }
}
</script>

<template>
  <!-- List View -->
  <div v-if="viewMode === 'list'" class="space-y-0.5">
    <div
      v-for="category in modelCategories"
      :key="category.id"
      class="select-none"
    >
      <SidebarTreeCategory
        :icon="category.icon"
        :label="category.label"
        :count="category.models.length"
        :expanded="category.expanded"
        @toggle="toggleCategory(category.id)"
      />

      <div
        v-if="category.expanded"
        class="ml-4 space-y-0.5 border-l border-zinc-800 pl-2"
      >
        <div
          v-for="model in category.models"
          :key="model.name"
          class="group flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 transition-colors hover:bg-zinc-800"
          draggable="true"
        >
          <i class="pi pi-file text-[10px] text-zinc-600 group-hover:text-zinc-400" />
          <div class="min-w-0 flex-1">
            <div class="truncate text-xs text-zinc-400 group-hover:text-zinc-200">
              {{ model.display }}
            </div>
            <div class="text-[10px] text-zinc-600">{{ model.size }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Grid View -->
  <div v-else class="grid grid-cols-2 gap-1.5">
    <template v-for="category in modelCategories" :key="category.id">
      <SidebarGridCard
        v-for="model in category.models"
        :key="model.name"
        :title="model.display"
        :subtitle="category.label"
        :draggable="true"
      >
        <template #header-left>
          <i :class="[category.icon, 'text-xs text-zinc-500']" />
        </template>
        <template #header-right>
          <span class="rounded bg-zinc-800 px-1 py-0.5 text-[9px] text-zinc-600">
            {{ model.size }}
          </span>
        </template>
      </SidebarGridCard>
    </template>
  </div>
</template>
