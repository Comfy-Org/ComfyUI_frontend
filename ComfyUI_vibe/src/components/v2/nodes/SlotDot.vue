<script setup lang="ts">
interface Props {
  color: string
  side: 'left' | 'right'
  connected?: boolean
}

withDefaults(defineProps<Props>(), {
  connected: false,
})
</script>

<template>
  <div
    :class="[
      'slot-dot relative flex items-center justify-center',
      side === 'left' ? '-ml-1' : '-mr-1',
    ]"
  >
    <!-- Outer ring on hover -->
    <div
      class="absolute h-4 w-4 rounded-full opacity-0 transition-opacity duration-150 group-hover:opacity-100"
      :style="{ backgroundColor: `${color}30` }"
    />

    <!-- Main dot -->
    <div
      :class="[
        'relative h-2.5 w-2.5 rounded-full border-[1.5px] transition-all duration-150',
        'cursor-crosshair',
      ]"
      :style="{
        backgroundColor: color,
        borderColor: '#1a1a1e',
        boxShadow: connected ? `0 0 4px ${color}` : undefined,
      }"
    />
  </div>
</template>

<style scoped>
.slot-dot {
  z-index: 10;
}
</style>
