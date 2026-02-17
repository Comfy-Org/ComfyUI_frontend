<template>
  <div class="flex items-center gap-2">
    <input
      type="text"
      readonly
      :value="url"
      class="flex-1 rounded-lg border border-border-default bg-secondary-background px-3 py-2 text-sm text-base-foreground outline-none"
      @focus="($event.target as HTMLInputElement).select()"
    />
    <Button variant="secondary" size="md" @click="copyUrl">
      {{
        copied ? $t('shareWorkflow.linkCopied') : $t('shareWorkflow.copyLink')
      }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'

const { url } = defineProps<{
  url: string
}>()

const copied = ref(false)
let copyTimeout: ReturnType<typeof setTimeout> | null = null

async function copyUrl() {
  try {
    await navigator.clipboard.writeText(url)
    copied.value = true
    if (copyTimeout) clearTimeout(copyTimeout)
    copyTimeout = setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    // Clipboard API not available
  }
}
</script>
