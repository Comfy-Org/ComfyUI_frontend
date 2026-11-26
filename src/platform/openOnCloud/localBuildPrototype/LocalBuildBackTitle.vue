<template>
  <div class="flex items-center gap-1.5">
    <Button
      variant="muted-textonly"
      size="icon"
      class="-ml-2"
      :aria-label="$t('localBuildPrototype.list.back')"
      @click="emit('back')"
    >
      <i class="icon-[lucide--chevron-left] size-5" aria-hidden="true" />
    </Button>
    <DialogTitle class="my-0 text-xl">{{ title }}</DialogTitle>
  </div>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import DialogTitle from '@comfyorg/design-system/dialog/DialogTitle'

const { title } = defineProps<{ title: string }>()
const emit = defineEmits<{ back: [] }>()
</script>
