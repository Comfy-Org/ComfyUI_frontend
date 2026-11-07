<template>
  <div class="flex flex-col gap-5 p-6">
    <div class="flex items-start gap-4">
      <slot name="icon" />
      <div class="flex flex-col gap-1.5 pr-8">
        <DialogTitle class="my-0 text-lg">{{ title }}</DialogTitle>
        <p class="m-0 text-sm text-muted-foreground">
          {{ description }}
        </p>
      </div>
    </div>
    <slot />
    <div class="flex items-center justify-end gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import DialogTitle from '@comfyorg/design-system/dialog/DialogTitle'

const { title, description } = defineProps<{
  title: string
  description: string
}>()
</script>
