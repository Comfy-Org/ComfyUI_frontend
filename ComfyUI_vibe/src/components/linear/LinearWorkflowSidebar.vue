<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLinearModeStore } from '@/stores/linearModeStore'
import { TEMPLATE_CATEGORIES } from '@/data/linearTemplates'
import type { LinearWorkflowTemplate } from '@/types/linear'

const store = useLinearModeStore()

const searchQuery = ref('')
const selectedCategory = ref<string | null>(null)

const filteredTemplates = computed(() => {
  let templates = store.templates

  if (selectedCategory.value) {
    templates = templates.filter((t) => t.category === selectedCategory.value)
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    templates = templates.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query)
    )
  }

  return templates
})

function selectTemplate(template: LinearWorkflowTemplate): void {
  store.selectTemplate(template)
}

function isSelected(template: LinearWorkflowTemplate): boolean {
  return store.selectedTemplate?.id === template.id
}
</script>

<template>
  <aside class="flex h-full w-72 flex-col border-r border-zinc-800 bg-zinc-900">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
      <span class="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Workflows
      </span>
    </div>

    <!-- Search -->
    <div class="border-b border-zinc-800 p-2">
      <div class="flex items-center rounded bg-zinc-800 px-2 py-1.5">
        <i class="pi pi-search text-xs text-zinc-500" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search workflows..."
          class="ml-2 w-full bg-transparent text-xs text-zinc-300 outline-none placeholder:text-zinc-500"
        />
      </div>
    </div>

    <!-- Categories -->
    <div class="flex flex-wrap gap-1 border-b border-zinc-800 p-2">
      <button
        :class="[
          'rounded px-2 py-1 text-[10px] font-medium transition-colors',
          !selectedCategory
            ? 'bg-zinc-700 text-zinc-100'
            : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
        ]"
        @click="selectedCategory = null"
      >
        All
      </button>
      <button
        v-for="cat in TEMPLATE_CATEGORIES.slice(0, 4)"
        :key="cat.id"
        :class="[
          'rounded px-2 py-1 text-[10px] font-medium transition-colors',
          selectedCategory === cat.id
            ? 'bg-zinc-700 text-zinc-100'
            : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
        ]"
        @click="selectedCategory = cat.id"
      >
        {{ cat.name }}
      </button>
    </div>

    <!-- Template List -->
    <div class="flex-1 overflow-y-auto p-2">
      <div class="flex flex-col gap-1">
        <button
          v-for="template in filteredTemplates"
          :key="template.id"
          :class="[
            'group flex items-start gap-3 rounded-lg p-2.5 text-left transition-colors',
            isSelected(template)
              ? 'bg-zinc-800 ring-1 ring-zinc-600'
              : 'hover:bg-zinc-800/50'
          ]"
          @click="selectTemplate(template)"
        >
          <!-- Icon -->
          <div
            :class="[
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
              isSelected(template)
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700 group-hover:text-zinc-300'
            ]"
          >
            <i :class="['pi', template.icon, 'text-sm']" />
          </div>

          <!-- Info -->
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="truncate text-xs font-medium text-zinc-200">
                {{ template.name }}
              </span>
              <span
                v-if="template.featured"
                class="shrink-0 rounded bg-blue-600/20 px-1 py-0.5 text-[9px] font-medium text-blue-400"
              >
                Featured
              </span>
            </div>
            <p class="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-zinc-500">
              {{ template.description }}
            </p>
            <div class="mt-1 flex items-center gap-2">
              <span class="text-[9px] text-zinc-600">
                {{ template.steps.length }} steps
              </span>
            </div>
          </div>
        </button>

        <!-- Empty State -->
        <div
          v-if="!filteredTemplates.length"
          class="flex flex-col items-center justify-center py-8 text-zinc-500"
        >
          <i class="pi pi-inbox mb-2 text-2xl" />
          <span class="text-xs">No workflows found</span>
        </div>
      </div>
    </div>
  </aside>
</template>
