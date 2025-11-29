<script setup lang="ts">
interface Props {
  title: string
  subtitle?: string
  thumbnail?: string
  icon?: string
  iconClass?: string
  badge?: string
  badgeClass?: string
  starred?: boolean
  draggable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  subtitle: undefined,
  thumbnail: undefined,
  icon: undefined,
  iconClass: 'text-zinc-400',
  badge: undefined,
  badgeClass: 'bg-zinc-700 text-zinc-400',
  starred: false,
  draggable: true,
})

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <div
    class="group cursor-pointer overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80 transition-all hover:border-zinc-600 hover:bg-zinc-800/80"
    :draggable="props.draggable"
    @click="emit('click')"
  >
    <!-- Thumbnail -->
    <div class="relative aspect-[4/3] overflow-hidden bg-zinc-800">
      <img
        v-if="props.thumbnail"
        :src="props.thumbnail"
        :alt="props.title"
        class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <div
        v-else
        class="flex h-full w-full items-center justify-center"
      >
        <i :class="[props.icon || 'pi pi-file', 'text-2xl text-zinc-600']" />
      </div>

      <!-- Gradient overlay -->
      <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

      <!-- Starred indicator -->
      <div
        v-if="props.starred"
        class="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded bg-amber-500/20 backdrop-blur-sm"
      >
        <i class="pi pi-star-fill text-[10px] text-amber-400" />
      </div>

      <!-- Badge (top-right) -->
      <div
        v-if="props.badge"
        class="absolute right-1.5 top-1.5"
      >
        <span :class="['rounded px-1.5 py-0.5 text-[9px] font-medium backdrop-blur-sm', props.badgeClass]">
          {{ props.badge }}
        </span>
      </div>

      <!-- Icon badge (bottom-left) -->
      <div
        v-if="props.icon"
        class="absolute bottom-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded bg-black/40 backdrop-blur-sm"
      >
        <i :class="[props.icon, 'text-xs', props.iconClass]" />
      </div>

      <!-- Add button (bottom-right, on hover) -->
      <button
        class="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded bg-white/90 text-zinc-800 opacity-0 transition-all hover:bg-white group-hover:opacity-100"
        @click.stop
      >
        <i class="pi pi-plus text-xs" />
      </button>
    </div>

    <!-- Content -->
    <div class="p-2">
      <div class="truncate text-xs font-medium text-zinc-200 group-hover:text-white">
        {{ props.title }}
      </div>
      <div v-if="props.subtitle" class="mt-0.5 truncate text-[10px] text-zinc-500">
        {{ props.subtitle }}
      </div>
    </div>
  </div>
</template>
