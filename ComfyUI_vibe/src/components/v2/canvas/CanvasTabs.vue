<script setup lang="ts">
export interface CanvasTab {
  id: string
  name: string
  isActive: boolean
  isDirty?: boolean
}

const props = defineProps<{
  tabs: CanvasTab[]
  activeTabId: string
}>()

const emit = defineEmits<{
  select: [tabId: string]
  close: [tabId: string]
  new: []
}>()

function handleClose(tabId: string, event: MouseEvent): void {
  event.stopPropagation()
  emit('close', tabId)
}
</script>

<template>
  <div class="flex flex-1 items-center gap-0.5 overflow-hidden">
    <!-- Tabs Container -->
    <div class="flex items-center gap-0.5 overflow-x-auto scrollbar-hide">
      <button
        v-for="tab in props.tabs"
        :key="tab.id"
        class="group flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-xs transition-colors"
        :class="[
          tab.id === props.activeTabId
            ? 'bg-zinc-800 text-zinc-100'
            : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-400'
        ]"
        @click="emit('select', tab.id)"
      >
        <span class="max-w-[150px] truncate">{{ tab.name }}</span>
        <span v-if="tab.isDirty" class="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
        <span
          class="flex h-4 w-4 items-center justify-center rounded text-zinc-600 opacity-0 transition-all hover:bg-zinc-700 hover:text-zinc-300 group-hover:opacity-100"
          @click="handleClose(tab.id, $event)"
        >
          <i class="pi pi-times text-[10px]" />
        </span>
      </button>
    </div>

    <!-- New Tab Button -->
    <button
      v-tooltip.bottom="{ value: 'New Workflow', showDelay: 50 }"
      class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-400"
      @click="emit('new')"
    >
      <i class="pi pi-plus text-xs" />
    </button>
  </div>
</template>

<style scoped>
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>
