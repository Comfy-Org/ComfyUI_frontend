<template>
  <div
    v-if="isLoading"
    class="flex h-full flex-col items-center justify-center"
  >
    <div
      class="size-12 animate-spin rounded-full border-4 border-primary border-t-transparent"
    />
    <p class="mt-4 text-muted-foreground">
      {{ $t('modelBrowser.loading') }}
    </p>
  </div>

  <div
    v-else-if="error"
    class="flex h-full flex-col items-center justify-center"
  >
    <i class="icon-[lucide--alert-circle] size-12 text-danger" />
    <p class="mt-4 text-danger">{{ $t('modelBrowser.errorLoading') }}</p>
    <Button class="mt-4" @click="$emit('retry')">
      {{ $t('modelBrowser.retry') }}
    </Button>
  </div>

  <div
    v-else-if="isEmpty"
    class="flex h-full flex-col items-center justify-center"
  >
    <i class="icon-[lucide--inbox] size-12 text-muted-foreground" />
    <p class="mt-4 text-muted-foreground">
      {{ emptyMessage }}
    </p>
    <Button
      v-if="showClearFilters"
      variant="textonly"
      class="mt-4"
      @click="$emit('clear-filters')"
    >
      {{ $t('modelBrowser.clearFilters') }}
    </Button>
  </div>

  <slot v-else />
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

defineProps<{
  isLoading: boolean
  error: Error | null
  isEmpty: boolean
  emptyMessage: string
  showClearFilters: boolean
}>()

defineEmits<{
  retry: []
  'clear-filters': []
}>()
</script>
