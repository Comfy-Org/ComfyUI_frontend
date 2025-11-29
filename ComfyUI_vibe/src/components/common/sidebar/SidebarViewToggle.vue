<script setup lang="ts">
type ViewMode = 'list' | 'grid'

const model = defineModel<ViewMode>({ required: true })
</script>

<template>
  <div class="flex items-center rounded bg-zinc-800 p-0.5">
    <button
      v-tooltip.bottom="{ value: 'List View', showDelay: 50 }"
      class="flex h-6 w-6 items-center justify-center rounded transition-colors"
      :class="model === 'list' ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'"
      @click="model = 'list'"
    >
      <i class="pi pi-list text-[10px]" />
    </button>
    <button
      v-tooltip.bottom="{ value: 'Grid View', showDelay: 50 }"
      class="flex h-6 w-6 items-center justify-center rounded transition-colors"
      :class="model === 'grid' ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'"
      @click="model = 'grid'"
    >
      <i class="pi pi-th-large text-[10px]" />
    </button>
  </div>
</template>
