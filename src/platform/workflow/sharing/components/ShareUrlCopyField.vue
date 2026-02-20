<template>
  <div class="flex items-center gap-2">
    <Input
      readonly
      :model-value="url"
      class="flex-1"
      @focus="($event.target as HTMLInputElement).select()"
    />
    <Button variant="secondary" size="md" @click="handleCopy">
      {{
        copied ? $t('shareWorkflow.linkCopied') : $t('shareWorkflow.copyLink')
      }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { useClipboard } from '@vueuse/core'

import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'

const { url } = defineProps<{
  url: string
}>()

const { copy, copied } = useClipboard({ copiedDuring: 2000 })

async function handleCopy() {
  await copy(url)
}
</script>
