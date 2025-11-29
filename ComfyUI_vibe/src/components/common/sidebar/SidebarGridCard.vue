<script setup lang="ts">
interface Props {
  title: string
  subtitle?: string
  draggable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  draggable: false,
})

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <div
    class="group cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900 p-2 transition-all hover:border-zinc-700 hover:bg-zinc-800/50"
    :draggable="props.draggable"
    @click="emit('click')"
  >
    <!-- Header slot for icon/badge row -->
    <div class="mb-1 flex items-center justify-between">
      <slot name="header-left" />
      <slot name="header-right" />
    </div>

    <!-- Title -->
    <div class="truncate text-xs text-zinc-400 group-hover:text-zinc-200">
      {{ props.title }}
    </div>

    <!-- Subtitle -->
    <div v-if="props.subtitle" class="mt-0.5 truncate text-[10px] text-zinc-600">
      {{ props.subtitle }}
    </div>

    <!-- Extra content slot -->
    <slot name="footer" />
  </div>
</template>
