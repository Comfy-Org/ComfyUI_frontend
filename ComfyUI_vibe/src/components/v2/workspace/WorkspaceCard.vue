<script setup lang="ts">
interface Props {
  thumbnail: string
  title: string
  description?: string
  icon?: string
  badge?: string
  badgeClass?: string
  stats?: Array<{ icon: string; value: string | number }>
  updatedAt?: string
  actionLabel?: string
  actionIcon?: string
}

withDefaults(defineProps<Props>(), {
  description: undefined,
  icon: undefined,
  badge: undefined,
  badgeClass: 'bg-zinc-500/20 text-zinc-400',
  stats: () => [],
  updatedAt: undefined,
  actionLabel: undefined,
  actionIcon: undefined
})

const emit = defineEmits<{
  click: []
  menu: [event: MouseEvent]
}>()
</script>

<template>
  <div
    class="group cursor-pointer overflow-hidden rounded-lg border border-zinc-200 bg-white text-left transition-all hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    @click="emit('click')"
  >
    <div class="relative aspect-square overflow-hidden">
      <img
        :src="thumbnail"
        :alt="title"
        class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

      <!-- Type icon badge (bottom-left) -->
      <div
        v-if="icon"
        class="absolute bottom-2 left-2 flex h-8 w-8 items-center justify-center rounded-md bg-black/30 backdrop-blur-sm"
      >
        <i :class="[icon, 'text-sm text-white/90']" />
      </div>

      <!-- Menu button (top-right) -->
      <button
        class="absolute right-2 top-2 rounded p-1 text-white/70 opacity-0 transition-opacity hover:bg-black/20 hover:text-white group-hover:opacity-100"
        @click.stop="emit('menu', $event)"
      >
        <i class="pi pi-ellipsis-h text-sm" />
      </button>
    </div>

    <div class="p-3">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0 flex-1">
          <h3 class="truncate font-medium text-zinc-900 dark:text-zinc-100">{{ title }}</h3>
          <p v-if="description" class="mt-0.5 line-clamp-1 text-sm text-zinc-500 dark:text-zinc-400">
            {{ description }}
          </p>
        </div>
        <!-- Action button -->
        <span
          v-if="actionLabel"
          class="inline-flex flex-shrink-0 items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-950 dark:text-blue-400 dark:group-hover:bg-blue-600 dark:group-hover:text-white"
        >
          <i v-if="actionIcon" :class="[actionIcon, 'text-[10px]']" />
          {{ actionLabel }}
        </span>
      </div>

      <div v-if="badge || stats.length > 0 || updatedAt" class="mt-2 flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
        <!-- Badge -->
        <span v-if="badge" :class="['rounded px-1.5 py-0.5 text-[10px] font-medium', badgeClass]">
          {{ badge }}
        </span>

        <!-- Stats -->
        <template v-if="stats.length > 0">
          <span v-for="(stat, idx) in stats" :key="idx" class="flex items-center gap-1">
            <i v-if="stat.icon" :class="[stat.icon, 'text-[10px]']" />
            {{ stat.value }}
          </span>
        </template>

        <!-- Updated time -->
        <span v-if="updatedAt" class="ml-auto">{{ updatedAt }}</span>
      </div>
    </div>
  </div>
</template>
