<template>
  <section
    class="relative flex min-h-0 w-[min(32rem,calc(100vw-2rem))] flex-col gap-6 overflow-y-auto rounded-2xl border border-border-default bg-base-background p-8"
    :aria-labelledby="titleId"
  >
    <Button
      variant="muted-textonly"
      size="icon"
      class="absolute top-4 right-4"
      :aria-label="$t('g.close')"
      :disabled="closeDisabled"
      @click="onClose"
    >
      <i class="icon-[lucide--x] size-4" aria-hidden="true" />
    </Button>

    <div class="flex flex-col gap-5">
      <header class="flex flex-col gap-2 pr-8">
        <h2
          :id="titleId"
          class="m-0 flex items-center gap-2 text-2xl font-semibold text-base-foreground"
        >
          {{ title }}
          <slot name="title-icon" />
        </h2>
        <p v-if="subtitle" class="m-0 text-sm text-muted-foreground">
          {{ subtitle }}
        </p>
      </header>
      <slot />
    </div>

    <footer class="flex flex-wrap items-center justify-end gap-2">
      <slot name="actions" />
    </footer>
  </section>
</template>

<script setup lang="ts">
import { useId } from 'vue'

import Button from '@/components/ui/button/Button.vue'

const { closeDisabled = false } = defineProps<{
  title: string
  subtitle?: string
  closeDisabled?: boolean
  onClose: () => void
}>()

const titleId = useId()
</script>
