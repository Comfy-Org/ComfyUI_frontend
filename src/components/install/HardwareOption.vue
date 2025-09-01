<template>
  <button
    class="hardware-option flex flex-col items-center rounded-3xl transition-all duration-200"
    :class="{
      'selected-border bg-neutral-900/70': selected,
      'border-4 border-neutral-700 bg-neutral-900/70 hover:border-neutral-600':
        !selected
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
        :alt="title"
        class="w-full h-full object-cover"
      />
    </div>

    <!-- Text Content -->
    <div class="text-center mt-4">
      <div class="text-base font-normal text-neutral-100">{{ title }}</div>
      <div v-if="subtitle" class="text-sm text-neutral-500 mt-1">
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
  width: 170px;
  height: 190px;
  padding: 1.25rem;
}

.selected-border {
  border: 4px solid rgb(255, 235, 59);
}

.icon-container {
  width: 110px;
  height: 110px;
}

.hardware-option:focus {
  outline: none;
}
</style>
