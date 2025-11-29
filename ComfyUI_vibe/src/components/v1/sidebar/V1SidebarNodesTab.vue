<script setup lang="ts">
import { ref } from 'vue'
import { SidebarTreeCategory, SidebarTreeItem, SidebarGridCard } from '@/components/common/sidebar'
import { NODE_CATEGORIES_DATA, type NodeCategory } from '@/data/sidebarMockData'

defineProps<{
  viewMode: 'list' | 'grid'
}>()

const nodeCategories = ref<NodeCategory[]>(
  NODE_CATEGORIES_DATA.map(c => ({ ...c }))
)

function toggleCategory(categoryId: string): void {
  const category = nodeCategories.value.find(c => c.id === categoryId)
  if (category) {
    category.expanded = !category.expanded
  }
}
</script>

<template>
  <!-- List View -->
  <div v-if="viewMode === 'list'" class="space-y-0.5">
    <div
      v-for="category in nodeCategories"
      :key="category.id"
      class="select-none"
    >
      <SidebarTreeCategory
        :icon="category.icon"
        :label="category.label"
        :count="category.nodes.length"
        :expanded="category.expanded"
        @toggle="toggleCategory(category.id)"
      />

      <div
        v-if="category.expanded"
        class="ml-4 space-y-0.5 border-l border-zinc-800 pl-2"
      >
        <SidebarTreeItem
          v-for="node in category.nodes"
          :key="node.name"
          :label="node.display"
          :draggable="true"
        />
      </div>
    </div>
  </div>

  <!-- Grid View -->
  <div v-else class="grid grid-cols-2 gap-1.5">
    <template v-for="category in nodeCategories" :key="category.id">
      <SidebarGridCard
        v-for="node in category.nodes"
        :key="node.name"
        :title="node.display"
        :subtitle="category.label"
        :draggable="true"
      >
        <template #header-left>
          <i :class="[category.icon, 'text-xs text-zinc-500']" />
        </template>
        <template #header-right>
          <i class="pi pi-plus text-[10px] text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100" />
        </template>
      </SidebarGridCard>
    </template>
  </div>
</template>
