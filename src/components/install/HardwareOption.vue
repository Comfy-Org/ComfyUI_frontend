<template>
  <button
    class="hardware-option flex flex-col items-center rounded-3xl transition-all duration-200"
    :class="{
      'border-4 border-comfy-yellow bg-neutral-900/70': selected,
      'border-4 border-transparent bg-neutral-900/70': !selected
    }"
    @click="$emit('click')"
  >
    <!-- Icon/Logo Area - Rounded square container -->
    <div
      class="icon-container rounded-2xl bg-neutral-800 flex items-center justify-center overflow-hidden"
    >
      <img
        v-if="imagePath"
        :src="imagePath"
        :alt="placeholderText"
        class="w-full h-full object-cover"
        style="object-position: 57% center"
      />
      <span v-else class="text-xl font-medium text-neutral-400">
        {{ placeholderText }}
      </span>
    </div>

    <!-- Text Content -->
    <div v-if="subtitle" class="text-center mt-4">
      <div class="text-sm text-neutral-500">{{ subtitle }}</div>
    </div>
  </button>
</template>

<script setup lang="ts">
interface Props {
  imagePath?: string
  placeholderText: string
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
  width: 170px;
  height: 190px;
  padding: 1.25rem;
}

.icon-container {
  width: 110px;
  height: 110px;
  flex-shrink: 0;
}

.hardware-option:focus {
  outline: none;
}
</style>
