<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLinearModeStore } from '@/stores/linearModeStore'
import { TEMPLATE_CATEGORIES } from '@/data/linearTemplates'
import LinearTemplateCard from './LinearTemplateCard.vue'
import type { LinearWorkflowTemplate } from '@/types/linear'

const store = useLinearModeStore()

const selectedCategory = ref<string | null>(null)
const searchQuery = ref('')

const filteredTemplates = computed(() => {
  let templates = store.templates

  // Filter by category
  if (selectedCategory.value) {
    templates = templates.filter((t) => t.category === selectedCategory.value)
  }

  // Filter by search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    templates = templates.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.tags.some((tag) => tag.toLowerCase().includes(query))
    )
  }

  return templates
})

const featuredTemplates = computed(() =>
  store.templates.filter((t) => t.featured)
)

function selectTemplate(template: LinearWorkflowTemplate): void {
  store.selectTemplate(template)
}

function clearCategory(): void {
  selectedCategory.value = null
}
</script>

<template>
  <div class="template-selector">
    <!-- Header -->
    <div class="header">
      <div class="header-content">
        <h1 class="title">Create with AI</h1>
        <p class="subtitle">
          Choose a workflow template to get started
        </p>
      </div>

      <!-- Search -->
      <div class="search-wrapper">
        <i class="pi pi-search search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search workflows..."
          class="search-input"
        />
      </div>
    </div>

    <!-- Categories -->
    <div class="categories">
      <button
        :class="['category-chip', { active: !selectedCategory }]"
        @click="clearCategory"
      >
        All
      </button>
      <button
        v-for="category in TEMPLATE_CATEGORIES"
        :key="category.id"
        :class="['category-chip', { active: selectedCategory === category.id }]"
        @click="selectedCategory = category.id"
      >
        <i :class="['pi', category.icon]" />
        {{ category.name }}
      </button>
    </div>

    <!-- Featured Section (only when no filter) -->
    <section v-if="!selectedCategory && !searchQuery && featuredTemplates.length" class="section">
      <h2 class="section-title">
        <i class="pi pi-star-fill text-yellow-500" />
        Featured
      </h2>
      <div class="template-grid featured-grid">
        <LinearTemplateCard
          v-for="template in featuredTemplates"
          :key="template.id"
          :template="template"
          @select="selectTemplate"
        />
      </div>
    </section>

    <!-- All Templates -->
    <section class="section">
      <h2 v-if="!selectedCategory && !searchQuery" class="section-title">
        <i class="pi pi-th-large" />
        All Workflows
      </h2>
      <h2 v-else-if="selectedCategory" class="section-title">
        <i :class="['pi', TEMPLATE_CATEGORIES.find(c => c.id === selectedCategory)?.icon]" />
        {{ TEMPLATE_CATEGORIES.find(c => c.id === selectedCategory)?.name }}
      </h2>
      <h2 v-else class="section-title">
        <i class="pi pi-search" />
        Search Results
      </h2>

      <div v-if="filteredTemplates.length" class="template-grid">
        <LinearTemplateCard
          v-for="template in filteredTemplates"
          :key="template.id"
          :template="template"
          @select="selectTemplate"
        />
      </div>

      <div v-else class="empty-state">
        <i class="pi pi-inbox text-4xl text-zinc-600" />
        <p>No workflows found</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.template-selector {
  min-height: 100vh;
  background: #09090b;
  padding: 32px;
}

.header {
  max-width: 1200px;
  margin: 0 auto 32px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}

.header-content {
  flex: 1;
}

.title {
  font-size: 32px;
  font-weight: 700;
  color: #fafafa;
  margin: 0 0 8px;
}

.subtitle {
  font-size: 16px;
  color: #71717a;
  margin: 0;
}

.search-wrapper {
  position: relative;
  width: 280px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #71717a;
  font-size: 14px;
}

.search-input {
  width: 100%;
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 8px;
  padding: 10px 12px 10px 36px;
  color: #fafafa;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.search-input:focus {
  border-color: #3b82f6;
}

.search-input::placeholder {
  color: #52525b;
}

.categories {
  max-width: 1200px;
  margin: 0 auto 32px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.category-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 20px;
  color: #a1a1aa;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.category-chip:hover {
  border-color: #3f3f46;
  color: #fafafa;
}

.category-chip.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.section {
  max-width: 1200px;
  margin: 0 auto 48px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
  color: #fafafa;
  margin: 0 0 20px;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.featured-grid {
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 64px;
  color: #52525b;
}
</style>
