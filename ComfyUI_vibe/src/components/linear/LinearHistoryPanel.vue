<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLinearModeStore } from '@/stores/linearModeStore'
import type { LinearOutput } from '@/types/linear'

const store = useLinearModeStore()

const activeTab = ref<'queue' | 'history'>('queue')

const outputs = computed(() => store.outputs)
const isGenerating = computed(() => store.isGenerating)
const currentWorkflow = computed(() => store.currentWorkflow)

// Mock queue items
const queueItems = computed(() => {
  if (!isGenerating.value || !currentWorkflow.value) return []

  return [
    {
      id: currentWorkflow.value.id,
      name: currentWorkflow.value.templateName,
      status: 'running' as const,
      progress: store.executionProgress,
      currentStep: currentWorkflow.value.currentStepIndex + 1,
      totalSteps: currentWorkflow.value.steps.length,
    },
  ]
})

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function handleDownload(output: LinearOutput): void {
  const link = document.createElement('a')
  link.href = output.url
  link.download = output.filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function handleDelete(outputId: string): void {
  store.deleteOutput(outputId)
}

function handleClearHistory(): void {
  store.clearOutputs()
}
</script>

<template>
  <!-- Main content area - takes remaining space -->
  <main class="flex h-full flex-1 flex-col bg-zinc-950">
    <!-- Tabs -->
    <div class="flex border-b border-zinc-800">
      <button
        :class="[
          'flex-1 px-4 py-2.5 text-xs font-medium transition-colors',
          activeTab === 'queue'
            ? 'border-b-2 border-blue-600 text-zinc-100'
            : 'text-zinc-500 hover:text-zinc-300'
        ]"
        @click="activeTab = 'queue'"
      >
        Queue
        <span
          v-if="queueItems.length"
          class="ml-1.5 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] text-white"
        >
          {{ queueItems.length }}
        </span>
      </button>
      <button
        :class="[
          'flex-1 px-4 py-2.5 text-xs font-medium transition-colors',
          activeTab === 'history'
            ? 'border-b-2 border-blue-600 text-zinc-100'
            : 'text-zinc-500 hover:text-zinc-300'
        ]"
        @click="activeTab = 'history'"
      >
        History
        <span
          v-if="outputs.length"
          class="ml-1.5 rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400"
        >
          {{ outputs.length }}
        </span>
      </button>
    </div>

    <!-- Queue View -->
    <div v-if="activeTab === 'queue'" class="flex-1 overflow-y-auto">
      <!-- Active Queue Items -->
      <div v-if="queueItems.length" class="p-3">
        <div
          v-for="item in queueItems"
          :key="item.id"
          class="rounded-lg border border-zinc-800 bg-zinc-800/50 p-3"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
              <span class="text-xs font-medium text-zinc-200">{{ item.name }}</span>
            </div>
            <span class="text-[10px] text-zinc-500">
              Step {{ item.currentStep }}/{{ item.totalSteps }}
            </span>
          </div>

          <!-- Progress -->
          <div class="mt-2">
            <div class="h-1 overflow-hidden rounded-full bg-zinc-700">
              <div
                class="h-full rounded-full bg-blue-600 transition-all duration-300"
                :style="{ width: `${item.progress}%` }"
              />
            </div>
            <div class="mt-1 text-right text-[10px] text-zinc-500">
              {{ Math.round(item.progress) }}%
            </div>
          </div>
        </div>
      </div>

      <!-- Empty Queue -->
      <div
        v-else
        class="flex flex-col items-center justify-center py-12 text-zinc-500"
      >
        <i class="pi pi-clock mb-2 text-2xl" />
        <span class="text-xs">Queue is empty</span>
        <p class="mt-1 text-center text-[10px] text-zinc-600">
          Generated images will appear here
        </p>
      </div>
    </div>

    <!-- History View -->
    <div v-else class="flex flex-1 flex-col overflow-hidden">
      <!-- History Header -->
      <div
        v-if="outputs.length"
        class="flex items-center justify-between border-b border-zinc-800 px-3 py-2"
      >
        <span class="text-[10px] text-zinc-500">{{ outputs.length }} generations</span>
        <button
          class="text-[10px] text-zinc-500 transition-colors hover:text-red-400"
          @click="handleClearHistory"
        >
          Clear all
        </button>
      </div>

      <!-- History Grid -->
      <div v-if="outputs.length" class="flex-1 overflow-y-auto p-4">
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          <div
            v-for="output in outputs"
            :key="output.id"
            class="group relative aspect-square overflow-hidden rounded-lg bg-zinc-800"
          >
            <img
              :src="output.thumbnailUrl ?? output.url"
              :alt="output.filename"
              class="h-full w-full object-cover transition-transform group-hover:scale-105"
            />

            <!-- Hover Overlay -->
            <div
              class="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/80 via-transparent to-black/40 p-2 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <div class="flex justify-end">
                <button
                  class="flex h-6 w-6 items-center justify-center rounded bg-black/50 text-zinc-300 transition-colors hover:bg-red-600 hover:text-white"
                  @click="handleDelete(output.id)"
                >
                  <i class="pi pi-trash text-[10px]" />
                </button>
              </div>

              <div>
                <div class="flex items-center justify-between">
                  <span class="text-[10px] text-zinc-300">
                    {{ formatTime(output.createdAt) }}
                  </span>
                  <button
                    class="flex h-6 w-6 items-center justify-center rounded bg-black/50 text-zinc-300 transition-colors hover:bg-blue-600 hover:text-white"
                    @click="handleDownload(output)"
                  >
                    <i class="pi pi-download text-[10px]" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty History -->
      <div
        v-else
        class="flex flex-1 flex-col items-center justify-center text-zinc-500"
      >
        <i class="pi pi-images mb-2 text-2xl" />
        <span class="text-xs">No history yet</span>
        <p class="mt-1 text-center text-[10px] text-zinc-600">
          Your creations will appear here
        </p>
      </div>
    </div>
  </main>
</template>
