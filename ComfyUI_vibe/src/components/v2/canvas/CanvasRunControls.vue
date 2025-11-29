<script setup lang="ts">
import { ref } from 'vue'
import Popover from 'primevue/popover'

const runMenu = ref<InstanceType<typeof Popover> | null>(null)
const isRunning = ref(false)
const queueCount = ref(0)

function toggleRunMenu(event: Event): void {
  runMenu.value?.toggle(event)
}

function runWorkflow(): void {
  isRunning.value = true
  setTimeout(() => {
    isRunning.value = false
  }, 2000)
}

function runOnChange(): void {
  // Toggle run on change mode
}

function addToQueue(): void {
  queueCount.value++
}

function clearQueue(): void {
  queueCount.value = 0
}
</script>

<template>
  <div class="absolute right-4 top-4 z-10 flex items-center gap-2">
    <!-- Queue indicator -->
    <div
      v-if="queueCount > 0"
      class="flex items-center gap-1.5 rounded-md bg-amber-500/20 px-2.5 py-1.5 text-xs font-medium text-amber-400"
    >
      <i class="pi pi-list text-[10px]" />
      <span>{{ queueCount }} in queue</span>
      <button
        class="ml-1 rounded p-0.5 transition-colors hover:bg-amber-500/20"
        @click="clearQueue"
      >
        <i class="pi pi-times text-[10px]" />
      </button>
    </div>

    <!-- Add to Queue -->
    <button
      v-tooltip.bottom="{ value: 'Add to Queue', showDelay: 50 }"
      class="flex h-8 items-center gap-1.5 rounded-md bg-zinc-800/80 px-3 text-sm text-zinc-300 shadow-sm backdrop-blur transition-colors hover:bg-zinc-700 hover:text-white"
      @click="addToQueue"
    >
      <i class="pi pi-plus text-xs" />
      <span>Queue</span>
    </button>

    <!-- Run Button with Dropdown -->
    <div class="relative flex">
      <button
        class="flex h-8 items-center gap-1.5 rounded-l-md bg-blue-600 px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-500"
        :disabled="isRunning"
        @click="runWorkflow"
      >
        <i :class="['text-xs', isRunning ? 'pi pi-spin pi-spinner' : 'pi pi-play']" />
        <span>{{ isRunning ? 'Running...' : 'Run' }}</span>
      </button>
      <button
        class="flex h-8 items-center rounded-r-md border-l border-blue-500 bg-blue-600 px-1.5 text-white shadow-sm transition-colors hover:bg-blue-500"
        @click="toggleRunMenu"
      >
        <i class="pi pi-chevron-down text-[10px]" />
      </button>

      <!-- Run Menu Popover -->
      <Popover ref="runMenu" append-to="self">
        <div class="flex w-48 flex-col py-1">
          <button
            class="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            @click="runWorkflow(); runMenu?.hide()"
          >
            <i class="pi pi-play text-xs text-blue-500" />
            <span>Run Workflow</span>
            <span class="ml-auto text-xs text-zinc-400">⌘↵</span>
          </button>
          <button
            class="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            @click="runOnChange(); runMenu?.hide()"
          >
            <i class="pi pi-sync text-xs text-green-500" />
            <span>Run on Change</span>
          </button>
          <div class="my-1 h-px bg-zinc-200 dark:bg-zinc-700" />
          <button
            class="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            @click="addToQueue(); runMenu?.hide()"
          >
            <i class="pi pi-plus text-xs text-amber-500" />
            <span>Add to Queue</span>
            <span class="ml-auto text-xs text-zinc-400">⌘⇧↵</span>
          </button>
          <button
            class="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            @click="clearQueue(); runMenu?.hide()"
          >
            <i class="pi pi-trash text-xs text-red-500" />
            <span>Clear Queue</span>
          </button>
        </div>
      </Popover>
    </div>
  </div>
</template>
