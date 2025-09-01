<template>
  <button
    class="hardware-option flex flex-col items-center rounded-2xl border-2 transition-all duration-200"
    :class="{
      'border-yellow-400 bg-neutral-800/50': selected,
      'border-neutral-700 bg-neutral-900/50 hover:border-neutral-600': !selected
    }"
    @click="$emit('click')"
  >
    <!-- Icon/Logo Area - Rounded square container -->
    <div class="icon-container rounded-xl bg-neutral-800 flex items-center justify-center">
      <img
        v-if="imagePath"
        :src="imagePath"
        :alt="title"
        class="max-h-16 max-w-full object-contain"
      />
    </div>
    
    <!-- Text Content -->
    <div class="text-center mt-3">
      <div class="text-sm font-normal text-neutral-100">{{ title }}</div>
      <div v-if="subtitle" class="text-xs text-neutral-500 mt-1">
        {{ subtitle }}
      </div>
    </div>
  </button>
</template>

<script setup lang="ts">
interface Props {
  imagePath?: string
  title: string
  subtitle?: string
  value: string
  selected?: boolean
}

defineProps<Props>()

defineEmits<{
  click: []
}>()
</script>

<style scoped>
.hardware-option {
  width: 160px;
  height: 180px;
  padding: 1.25rem;
}

.icon-container {
  width: 120px;
  height: 100px;
}

.hardware-option:focus {
  outline: none;
}
</style>