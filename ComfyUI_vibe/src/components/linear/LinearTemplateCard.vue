<script setup lang="ts">
import type { LinearWorkflowTemplate } from '@/types/linear'

interface Props {
  template: LinearWorkflowTemplate
}

defineProps<Props>()

const emit = defineEmits<{
  select: [template: LinearWorkflowTemplate]
}>()
</script>

<template>
  <button
    class="template-card group"
    @click="emit('select', template)"
  >
    <!-- Thumbnail -->
    <div class="thumbnail">
      <img
        v-if="template.thumbnailUrl"
        :src="template.thumbnailUrl"
        :alt="template.name"
        class="thumbnail-img"
      />
      <div v-else class="thumbnail-placeholder">
        <i :class="['pi', template.icon, 'text-2xl text-zinc-500']" />
      </div>

      <!-- Featured badge -->
      <span v-if="template.featured" class="featured-badge">
        Featured
      </span>

      <!-- Hover overlay -->
      <div class="hover-overlay">
        <span class="use-btn">Use Template</span>
      </div>
    </div>

    <!-- Content -->
    <div class="content">
      <div class="header">
        <i :class="['pi', template.icon, 'text-sm text-zinc-400']" />
        <h3 class="title">{{ template.name }}</h3>
      </div>
      <p class="description">{{ template.description }}</p>

      <!-- Tags -->
      <div class="tags">
        <span
          v-for="tag in template.tags.slice(0, 3)"
          :key="tag"
          class="tag"
        >
          {{ tag }}
        </span>
      </div>
    </div>
  </button>
</template>

<style scoped>
.template-card {
  background: #27272a;
  border: 1px solid #3f3f46;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  width: 100%;
}

.template-card:hover {
  border-color: #52525b;
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.thumbnail {
  position: relative;
  aspect-ratio: 4 / 3;
  background: #18181b;
  overflow: hidden;
}

.thumbnail-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.template-card:hover .thumbnail-img {
  transform: scale(1.05);
}

.thumbnail-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #27272a, #18181b);
}

.featured-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: white;
  font-size: 10px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.hover-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.template-card:hover .hover-overlay {
  opacity: 1;
}

.use-btn {
  background: #3b82f6;
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  transform: translateY(8px);
  transition: transform 0.2s ease;
}

.template-card:hover .use-btn {
  transform: translateY(0);
}

.content {
  padding: 12px;
}

.header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.title {
  font-size: 14px;
  font-weight: 600;
  color: #fafafa;
  margin: 0;
}

.description {
  font-size: 12px;
  color: #a1a1aa;
  margin: 0 0 8px 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag {
  font-size: 10px;
  color: #71717a;
  background: #3f3f46;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: lowercase;
}
</style>
