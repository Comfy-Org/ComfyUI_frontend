<script setup lang="ts">
import { onMounted } from 'vue'

import Button from '@/components/ui/button/Button.vue'

const emit = defineEmits<{ dismiss: []; shown: [] }>()

onMounted(() => emit('shown'))
</script>

<template>
  <div
    role="status"
    aria-live="polite"
    class="relative flex items-start gap-2 overflow-hidden rounded-lg bg-background p-4 ring-1 ring-border/50 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-warning"
  >
    <span
      class="icon-[heroicons--information-circle-20-solid] size-5 shrink-0 text-warning"
    />
    <p class="my-0 min-w-0 flex-1 text-sm">
      {{ $t('agent.creditTransitionNotice') }}
    </p>
    <Button
      type="button"
      variant="muted-textonly"
      size="icon-sm"
      :aria-label="$t('agent.dismiss')"
      class="shrink-0"
      @click="emit('dismiss')"
    >
      <span class="icon-[lucide--x] size-5" />
    </Button>
  </div>
</template>
