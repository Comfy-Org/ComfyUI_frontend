<script setup lang="ts">
import { ref } from 'vue'
import type { LinearOutput } from '@/types/linear'

interface Props {
  outputs: LinearOutput[]
}

defineProps<Props>()

const emit = defineEmits<{
  delete: [outputId: string]
  download: [output: LinearOutput]
  select: [output: LinearOutput]
}>()

const selectedOutput = ref<LinearOutput | null>(null)

function openLightbox(output: LinearOutput): void {
  selectedOutput.value = output
  emit('select', output)
}

function closeLightbox(): void {
  selectedOutput.value = null
}

function downloadImage(output: LinearOutput): void {
  emit('download', output)
}

function deleteOutput(outputId: string, event: Event): void {
  event.stopPropagation()
  emit('delete', outputId)
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
</script>

<template>
  <div class="output-gallery">
    <!-- Gallery header -->
    <div class="gallery-header">
      <h3 class="gallery-title">
        <i class="pi pi-images" />
        Generated Images
      </h3>
      <span class="gallery-count">{{ outputs.length }} images</span>
    </div>

    <!-- Gallery grid -->
    <div v-if="outputs.length" class="gallery-grid">
      <div
        v-for="output in outputs"
        :key="output.id"
        class="gallery-item"
        @click="openLightbox(output)"
      >
        <img
          :src="output.thumbnailUrl ?? output.url"
          :alt="output.filename"
          class="gallery-image"
        />

        <!-- Overlay -->
        <div class="item-overlay">
          <div class="overlay-top">
            <button
              class="overlay-btn"
              title="Delete"
              @click="deleteOutput(output.id, $event)"
            >
              <i class="pi pi-trash" />
            </button>
          </div>
          <div class="overlay-bottom">
            <span class="item-time">{{ formatDate(output.createdAt) }}</span>
            <button
              class="overlay-btn"
              title="Download"
              @click.stop="downloadImage(output)"
            >
              <i class="pi pi-download" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="empty-state">
      <i class="pi pi-image text-4xl text-zinc-700" />
      <p class="empty-text">Your generated images will appear here</p>
    </div>

    <!-- Lightbox -->
    <Teleport to="body">
      <div v-if="selectedOutput" class="lightbox" @click="closeLightbox">
        <div class="lightbox-content" @click.stop>
          <button class="lightbox-close" @click="closeLightbox">
            <i class="pi pi-times" />
          </button>

          <img
            :src="selectedOutput.url"
            :alt="selectedOutput.filename"
            class="lightbox-image"
          />

          <div class="lightbox-info">
            <div class="info-row">
              <span class="info-label">Filename</span>
              <span class="info-value">{{ selectedOutput.filename }}</span>
            </div>
            <div v-if="selectedOutput.metadata?.prompt" class="info-row">
              <span class="info-label">Prompt</span>
              <span class="info-value prompt">{{ selectedOutput.metadata.prompt }}</span>
            </div>
            <div class="info-grid">
              <div v-if="selectedOutput.metadata?.seed" class="info-item">
                <span class="info-label">Seed</span>
                <span class="info-value">{{ selectedOutput.metadata.seed }}</span>
              </div>
              <div v-if="selectedOutput.metadata?.steps" class="info-item">
                <span class="info-label">Steps</span>
                <span class="info-value">{{ selectedOutput.metadata.steps }}</span>
              </div>
              <div v-if="selectedOutput.metadata?.cfg" class="info-item">
                <span class="info-label">CFG</span>
                <span class="info-value">{{ selectedOutput.metadata.cfg }}</span>
              </div>
              <div v-if="selectedOutput.metadata?.sampler" class="info-item">
                <span class="info-label">Sampler</span>
                <span class="info-value">{{ selectedOutput.metadata.sampler }}</span>
              </div>
            </div>

            <div class="lightbox-actions">
              <button class="action-btn secondary" @click="closeLightbox">
                Close
              </button>
              <button class="action-btn primary" @click="downloadImage(selectedOutput)">
                <i class="pi pi-download" />
                Download
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.output-gallery {
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 12px;
  overflow: hidden;
}

.gallery-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #1f1f23;
  border-bottom: 1px solid #27272a;
}

.gallery-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #fafafa;
  margin: 0;
}

.gallery-count {
  font-size: 12px;
  color: #71717a;
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
  padding: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.gallery-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  background: #27272a;
}

.gallery-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.gallery-item:hover .gallery-image {
  transform: scale(1.05);
}

.item-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.5) 0%,
    transparent 30%,
    transparent 70%,
    rgba(0, 0, 0, 0.7) 100%
  );
  opacity: 0;
  transition: opacity 0.2s;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 8px;
}

.gallery-item:hover .item-overlay {
  opacity: 1;
}

.overlay-top,
.overlay-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.overlay-top {
  justify-content: flex-end;
}

.overlay-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.5);
  border: none;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  transition: background 0.2s;
}

.overlay-btn:hover {
  background: rgba(0, 0, 0, 0.8);
}

.item-time {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.8);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 24px;
}

.empty-text {
  font-size: 13px;
  color: #52525b;
  margin: 0;
}

/* Lightbox */
.lightbox {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.9);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.lightbox-content {
  position: relative;
  max-width: 900px;
  max-height: 90vh;
  display: flex;
  gap: 24px;
  background: #18181b;
  border-radius: 16px;
  overflow: hidden;
}

.lightbox-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  border: none;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  z-index: 10;
  transition: background 0.2s;
}

.lightbox-close:hover {
  background: rgba(0, 0, 0, 0.8);
}

.lightbox-image {
  max-width: 600px;
  max-height: 80vh;
  object-fit: contain;
}

.lightbox-info {
  width: 280px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

.info-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 11px;
  color: #71717a;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-value {
  font-size: 13px;
  color: #fafafa;
}

.info-value.prompt {
  line-height: 1.5;
  max-height: 100px;
  overflow-y: auto;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.lightbox-actions {
  display: flex;
  gap: 8px;
  margin-top: auto;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.action-btn.primary {
  background: #3b82f6;
  color: white;
}

.action-btn.primary:hover {
  background: #2563eb;
}

.action-btn.secondary {
  background: #27272a;
  color: #a1a1aa;
}

.action-btn.secondary:hover {
  background: #3f3f46;
  color: #fafafa;
}
</style>
