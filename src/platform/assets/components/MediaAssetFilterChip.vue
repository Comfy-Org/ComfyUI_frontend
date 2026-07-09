<template>
  <span
    class="inline-flex items-center gap-1 rounded-md bg-secondary-background py-1 pr-1 pl-2 text-xs whitespace-nowrap"
  >
    <span>{{ label }}</span>
    <Button
      variant="textonly"
      size="icon"
      class="size-4 rounded-sm p-0 hover:bg-secondary-background-hover"
      :aria-label="$t('sideToolbar.mediaAssets.removeFilter', { label })"
      @click="emit('remove')"
    >
      <i class="icon-[lucide--x] size-3" />
    </Button>
  </span>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

defineProps<{ label: string }>()

const emit = defineEmits<{ remove: [] }>()
</script>
