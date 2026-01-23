<template>
  <Transition name="fade">
    <div
      v-if="loading"
      class="absolute inset-0 z-50 flex items-center justify-center bg-backdrop/50"
    >
      <div class="flex flex-col items-center">
        <div class="spinner" />
        <div class="mt-4 text-lg text-base-foreground">
          {{ loadingMessage }}
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{
  loading: boolean
  loadingMessage: string
}>()
</script>

<style scoped>
.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
