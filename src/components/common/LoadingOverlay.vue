<template>
  <Transition name="fade">
    <div
      v-if="loading"
      class="absolute inset-0 z-50 flex items-center justify-center bg-backdrop/50"
    >
      <div class="flex flex-col items-center">
        <div class="relative flex items-center justify-center">
          <div class="animate-spin spinner" />
          <div class="absolute">
            <slot />
          </div>
        </div>
        <div v-if="loadingMessage" class="mt-4 text-lg text-base-foreground">
          {{ loadingMessage }}
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{
  loading: boolean
  loadingMessage?: string
}>()
</script>

<style scoped>
.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid var(--muted-foreground);
  border-top-color: var(--base-foreground);
  border-radius: 50%;
}
</style>
