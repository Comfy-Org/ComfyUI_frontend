<template>
  <section
    class="relative flex min-h-0 w-[min(32rem,calc(100vw-2rem))] flex-col gap-6 overflow-y-auto rounded-2xl border bg-background p-8"
  >
    <Button
      variant="muted-textonly"
      size="icon"
      class="absolute top-4 right-4"
      :aria-label="$t('g.close')"
      :disabled="closeDisabled"
      @click="onClose"
    >
      <i class="icon-[lucide--x]" aria-hidden="true" />
    </Button>

    <div class="flex flex-col gap-5">
      <header class="flex flex-col gap-2 pr-8">
        <DialogTitle class="m-0 flex items-center gap-2 text-2xl">
          {{ title }}
          <slot name="title-icon" />
        </DialogTitle>
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
import Button from '@comfyorg/design-system/button/Button'
import DialogTitle from '@comfyorg/design-system/dialog/DialogTitle'

const { closeDisabled = false } = defineProps<{
  title: string
  subtitle?: string
  closeDisabled?: boolean
  onClose: () => void
}>()
</script>
