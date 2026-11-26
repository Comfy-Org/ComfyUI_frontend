<template>
  <AppDialogPanel
    body-class="flex flex-col gap-2 text-sm text-foreground"
    @close="onResult(null)"
  >
    <template #title>
      {{ title }}
    </template>

    <p class="m-0 wrap-break-word">{{ message }}</p>
    <ul class="m-0 max-h-48 list-disc overflow-y-auto ps-5 break-all">
      <li v-for="item of itemList" :key="item">{{ item }}</li>
    </ul>
    <p v-if="hint" role="status" class="m-0 flex gap-1 text-muted-foreground">
      <i class="mt-0.5 icon-[lucide--info]" aria-hidden="true" />
      {{ hint }}
    </p>

    <template #footer>
      <Button variant="secondary" size="lg" @click="onResult(false)">
        {{ denyLabel }}
      </Button>
      <Button variant="inverted" size="lg" autofocus @click="onResult(true)">
        {{ confirmLabel }}
      </Button>
    </template>
  </AppDialogPanel>
</template>

<script setup lang="ts">
import AppDialogPanel from '@/components/dialog/AppDialogPanel.vue'
import Button from '@comfyorg/design-system/button/Button'

defineProps<{
  title: string
  message: string
  itemList: string[]
  hint?: string
  denyLabel: string
  confirmLabel: string
  onResult: (result: boolean | null) => void
}>()
</script>
