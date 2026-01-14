<template>
  <Transition name="fade">
    <div
      v-if="loading"
      class="absolute inset-0 z-50 flex items-center justify-center bg-backdrop/50"
    >
      <div class="flex flex-col items-center">
        <div class="grid place-items-center">
          <div
            class="col-start-1 row-start-1 h-12 w-12 animate-spin rounded-full border-4 border-muted-foreground border-t-base-foreground"
          />
          <div class="col-start-1 row-start-1">
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
