<template>
  <div
    class="mx-auto flex h-full max-w-[400px] flex-col items-stretch justify-between text-sm motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
  >
    <div class="flex flex-col items-center gap-4 pt-8">
      <i class="pi pi-exclamation-circle text-5xl text-warning-background" />
      <h2
        class="m-0 text-center text-xl font-semibold text-base-foreground lg:text-2xl"
      >
        {{ $t('subscription.processingError.title') }}
      </h2>
      <p class="m-0 text-center text-sm text-muted-foreground">
        {{ $t('subscription.processingError.body') }}
      </p>
    </div>

    <div class="flex flex-col gap-2 pt-8 pb-4">
      <Button
        variant="inverted"
        size="lg"
        class="w-full rounded-lg"
        @click="$emit('tryAgain')"
      >
        {{ $t('subscription.processingError.tryAgain') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

defineEmits<{
  /** Return to the confirm step with the quote and selection intact. */
  tryAgain: []
}>()
</script>
