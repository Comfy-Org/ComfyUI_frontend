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
      side === 'left' ? '-ml-1.5' : '-mr-1.5',
    ]"
  >
    <!-- Outer ring on hover -->
    <div
      class="absolute h-5 w-5 rounded-full opacity-0 transition-opacity duration-150 group-hover:opacity-100"
      :style="{ backgroundColor: `${color}30` }"
    />

    <!-- Main dot -->
    <div
      :class="[
        'relative h-3 w-3 rounded-full border-2 border-zinc-900 transition-all duration-150',
        'cursor-crosshair',
      ]"
      :style="{
        backgroundColor: color,
        boxShadow: connected ? `0 0 6px ${color}` : undefined,
      }"
    >
      <!-- Inner highlight -->
      <div
        class="absolute inset-0.5 rounded-full opacity-40"
        :style="{ background: `linear-gradient(135deg, white 0%, transparent 50%)` }"
      />
    </div>
  </div>
</template>

<style scoped>
.slot-dot {
  z-index: 10;
}
</style>
