<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

const emit = defineEmits<{
  newChat: []
  close: []
}>()
</script>

<template>
  <div
    class="flex h-12 shrink-0 items-center justify-between border-b border-component-node-border px-4"
  >
    <div class="flex items-center gap-2">
      <span class="text-sm text-base-foreground">{{ $t('agent.title') }}</span>
      <span
        class="rounded-full border border-border-default px-2 py-0.5 text-xs text-muted-foreground"
      >
        {{ $t('agent.alpha') }}
      </span>
    </div>
    <div class="flex items-center gap-1">
      <Button
        variant="textonly"
        size="icon"
        :aria-label="$t('agent.newChat')"
        @click="emit('newChat')"
      >
        <i class="icon-[lucide--message-circle] size-4" />
      </Button>
      <Button
        variant="textonly"
        size="icon"
        :aria-label="$t('agent.togglePanel')"
      >
        <i class="icon-[lucide--panel-right] size-4" />
      </Button>
      <Button
        variant="textonly"
        size="icon"
        :aria-label="$t('g.close')"
        @click="emit('close')"
      >
        <i class="icon-[lucide--x] size-4" />
      </Button>
    </div>
  </div>
</template>
