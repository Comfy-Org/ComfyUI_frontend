<template>
  <div class="@container w-[min(640px,calc(100vw-2rem))]">
    <div
      v-bind="$attrs"
      class="relative max-h-[85dvh] overflow-y-auto rounded-2xl border border-component-node-border bg-background shadow-[0_20px_24px_-4px_rgba(10,13,18,0.4),0_8px_8px_-4px_rgba(10,13,18,0.25),0_3px_3px_-1.5px_rgba(10,13,18,0.2)]"
    >
      <Button
        variant="muted-textonly"
        size="icon"
        :aria-label="$t('g.close')"
        class="absolute top-3 right-3 z-20"
        @click="emit('dismiss')"
      >
        <i class="icon-[lucide--x]" />
      </Button>
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'

defineOptions({ inheritAttrs: false })

const emit = defineEmits<{
  dismiss: []
}>()
</script>
