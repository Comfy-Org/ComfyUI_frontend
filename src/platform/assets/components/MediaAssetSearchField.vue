<template>
  <div
    class="focus-within:ring-secondary-foreground flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg bg-secondary-background px-3 focus-within:ring-1"
  >
    <i
      class="icon-[lucide--search] size-4 shrink-0 text-muted-foreground"
      aria-hidden="true"
    />
    <input
      v-model="model"
      type="text"
      :placeholder="placeholder"
      class="min-w-0 flex-1 border-none bg-transparent text-sm text-base-foreground outline-none placeholder:text-muted-foreground"
    />
    <Button
      v-if="model"
      variant="textonly"
      size="icon-sm"
      :aria-label="$t('g.clear')"
      @click="model = ''"
    >
      <i class="icon-[lucide--x] size-3.5" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

const { placeholder = '' } = defineProps<{ placeholder?: string }>()

const model = defineModel<string>({ required: true })
</script>
