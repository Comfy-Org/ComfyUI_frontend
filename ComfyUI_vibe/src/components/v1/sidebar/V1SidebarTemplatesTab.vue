<script setup lang="ts">
import { ref } from 'vue'
import { SidebarTreeCategory, SidebarGridCard } from '@/components/common/sidebar'
import { TEMPLATE_CATEGORIES_DATA, type TemplateCategory } from '@/data/sidebarMockData'

defineProps<{
  viewMode: 'list' | 'grid'
}>()

const templateCategories = ref<TemplateCategory[]>(
  TEMPLATE_CATEGORIES_DATA.map(c => ({ ...c }))
)

function toggleCategory(categoryId: string): void {
  const category = templateCategories.value.find(c => c.id === categoryId)
  if (category) {
    category.expanded = !category.expanded
  }
}
</script>

<template>
  <!-- List View -->
  <div v-if="viewMode === 'list'" class="space-y-0.5">
    <div
      v-for="category in templateCategories"
      :key="category.id"
      class="select-none"
    >
      <SidebarTreeCategory
        :icon="category.icon"
        :label="category.label"
        :count="category.templates.length"
        :expanded="category.expanded"
        @toggle="toggleCategory(category.id)"
      />

      <div
        v-if="category.expanded"
        class="ml-4 space-y-0.5 border-l border-zinc-800 pl-2"
      >
        <div
          v-for="template in category.templates"
          :key="template.name"
          class="group flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 transition-colors hover:bg-zinc-800"
          draggable="true"
        >
          <i class="pi pi-clone text-[10px] text-zinc-600 group-hover:text-zinc-400" />
          <div class="min-w-0 flex-1">
            <div class="truncate text-xs text-zinc-400 group-hover:text-zinc-200">
              {{ template.display }}
            </div>
            <div class="truncate text-[10px] text-zinc-600">{{ template.description }}</div>
          </div>
          <span class="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-600">
            {{ template.nodes }}
          </span>
          <i class="pi pi-plus text-[10px] text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </div>
    </div>
  </div>

  <!-- Grid View -->
  <div v-else class="grid grid-cols-2 gap-1.5">
    <template v-for="category in templateCategories" :key="category.id">
      <SidebarGridCard
        v-for="template in category.templates"
        :key="template.name"
        :title="template.display"
        :subtitle="template.description"
        :draggable="true"
      >
        <template #header-left>
          <i :class="[category.icon, 'text-xs text-zinc-500']" />
        </template>
        <template #header-right>
          <span class="rounded bg-zinc-800 px-1 py-0.5 text-[9px] text-zinc-600">
            {{ template.nodes }} nodes
          </span>
        </template>
      </SidebarGridCard>
    </template>
  </div>
</template>
