<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLinearModeStore } from '@/stores/linearModeStore'

const store = useLinearModeStore()

const isGenerating = computed(() => store.isGenerating)
const currentWorkflow = computed(() => store.currentWorkflow)

// Mock batches for demo - each batch is a generation session with multiple outputs
const batches = ref([
  {
    id: 'batch-1',
    prompt: 'A mystical forest with glowing mushrooms and fairy lights, cinematic lighting, 8k',
    model: 'Gen-4 Turbo',
    duration: '5s',
    createdAt: '2 min ago',
    settings: { seed: 123456, steps: 30, cfg: 7.5 },
    outputs: [
      { id: '1a', url: 'https://picsum.photos/seed/forest1/400/400', type: 'image' },
      { id: '1b', url: 'https://picsum.photos/seed/forest2/400/400', type: 'image' },
      { id: '1c', url: 'https://picsum.photos/seed/forest3/400/400', type: 'video' },
      { id: '1d', url: 'https://picsum.photos/seed/forest4/400/400', type: 'image' },
    ],
  },
  {
    id: 'batch-2',
    prompt: 'Cyberpunk city at night with neon lights and rain reflections',
    model: 'Gen-4',
    duration: '10s',
    createdAt: '15 min ago',
    settings: { seed: 789012, steps: 25, cfg: 8 },
    outputs: [
      { id: '2a', url: 'https://picsum.photos/seed/cyber1/400/400', type: 'video' },
      { id: '2b', url: 'https://picsum.photos/seed/cyber2/400/400', type: 'image' },
    ],
  },
  {
    id: 'batch-3',
    prompt: 'Portrait of a woman with dramatic lighting, studio photography',
    model: 'Gen-4 Turbo',
    duration: '5s',
    createdAt: '1 hour ago',
    settings: { seed: 345678, steps: 30, cfg: 7 },
    outputs: [
      { id: '3a', url: 'https://picsum.photos/seed/portrait1/400/400', type: 'image' },
      { id: '3b', url: 'https://picsum.photos/seed/portrait2/400/400', type: 'image' },
      { id: '3c', url: 'https://picsum.photos/seed/portrait3/400/400', type: 'image' },
    ],
  },
  {
    id: 'batch-4',
    prompt: 'Abstract fluid art in blue and gold, macro photography',
    model: 'Flash 2.5',
    duration: '5s',
    createdAt: '3 hours ago',
    settings: { seed: 901234, steps: 20, cfg: 6.5 },
    outputs: [
      { id: '4a', url: 'https://picsum.photos/seed/abstract1/400/400', type: 'image' },
    ],
  },
])

// Current generation progress
const queueItem = computed(() => {
  if (!isGenerating.value || !currentWorkflow.value) return null

  return {
    id: currentWorkflow.value.id,
    name: currentWorkflow.value.templateName,
    progress: store.executionProgress,
  }
})

function copyPrompt(prompt: string): void {
  navigator.clipboard.writeText(prompt)
}

function deleteBatch(batchId: string): void {
  const index = batches.value.findIndex(b => b.id === batchId)
  if (index > -1) {
    batches.value.splice(index, 1)
  }
}

function downloadAll(batchId: string): void {
  console.log('Download all from batch:', batchId)
}

function reuseSettings(batchId: string): void {
  console.log('Reuse settings from batch:', batchId)
}
</script>

<template>
  <!-- Main content area - Batch gallery of creations -->
  <main class="flex h-full flex-1 flex-col bg-zinc-950">
    <div class="flex-1 overflow-y-auto">
      <!-- Currently Generating Batch -->
      <div v-if="queueItem" class="border-b border-zinc-800 p-6">
        <div class="mb-4 flex items-center gap-3">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <i class="pi pi-spin pi-spinner text-sm text-white" />
          </div>
          <div class="flex-1">
            <div class="text-sm font-medium text-zinc-200">Generating...</div>
            <div class="text-xs text-zinc-500">{{ Math.round(queueItem.progress) }}% complete</div>
          </div>
        </div>
        <div class="h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <div
            class="h-full rounded-full bg-blue-500 transition-all duration-300"
            :style="{ width: `${queueItem.progress}%` }"
          />
        </div>
      </div>

      <!-- Batch Sections -->
      <div
        v-for="batch in batches"
        :key="batch.id"
        class="border-b border-zinc-800 p-6"
      >
        <!-- Batch Header -->
        <div class="mb-4 flex items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <!-- Prompt -->
            <p class="text-sm leading-relaxed text-zinc-200">
              {{ batch.prompt }}
            </p>
            <!-- Meta Info -->
            <div class="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
              <span class="flex items-center gap-1">
                <i class="pi pi-box text-[10px]" />
                {{ batch.model }}
              </span>
              <span class="flex items-center gap-1">
                <i class="pi pi-clock text-[10px]" />
                {{ batch.duration }}
              </span>
              <span class="flex items-center gap-1">
                <i class="pi pi-history text-[10px]" />
                {{ batch.createdAt }}
              </span>
              <span class="text-zinc-600">•</span>
              <span class="text-zinc-600">
                Seed: {{ batch.settings.seed }} · Steps: {{ batch.settings.steps }} · CFG: {{ batch.settings.cfg }}
              </span>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex shrink-0 items-center gap-1">
            <button
              v-tooltip.bottom="'Copy prompt'"
              class="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              @click="copyPrompt(batch.prompt)"
            >
              <i class="pi pi-copy text-sm" />
            </button>
            <button
              v-tooltip.bottom="'Reuse settings'"
              class="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              @click="reuseSettings(batch.id)"
            >
              <i class="pi pi-replay text-sm" />
            </button>
            <button
              v-tooltip.bottom="'Download all'"
              class="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              @click="downloadAll(batch.id)"
            >
              <i class="pi pi-download text-sm" />
            </button>
            <button
              v-tooltip.bottom="'Delete batch'"
              class="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-red-400"
              @click="deleteBatch(batch.id)"
            >
              <i class="pi pi-trash text-sm" />
            </button>
          </div>
        </div>

        <!-- Outputs Grid -->
        <div class="flex flex-wrap gap-4">
          <div
            v-for="output in batch.outputs"
            :key="output.id"
            class="group relative h-48 w-48 cursor-pointer overflow-hidden rounded-xl bg-zinc-900 transition-all hover:ring-2 hover:ring-blue-500/50"
          >
            <img
              :src="output.url"
              :alt="batch.prompt"
              class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />

            <!-- Video indicator -->
            <div
              v-if="output.type === 'video'"
              class="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-black/70"
            >
              <i class="pi pi-play text-[8px] text-white" />
            </div>

            <!-- Hover Overlay -->
            <div class="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <div class="flex gap-1">
                <button class="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/30">
                  <i class="pi pi-eye text-xs" />
                </button>
                <button class="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/30">
                  <i class="pi pi-download text-xs" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-if="batches.length === 0 && !queueItem"
        class="flex h-full flex-col items-center justify-center p-12 text-zinc-500"
      >
        <div class="flex h-20 w-20 items-center justify-center rounded-2xl bg-zinc-900">
          <i class="pi pi-images text-3xl" />
        </div>
        <h3 class="mt-4 text-sm font-medium text-zinc-300">No creations yet</h3>
        <p class="mt-1 text-center text-xs text-zinc-600">
          Your generated images and videos will appear here
        </p>
      </div>
    </div>
  </main>
</template>
