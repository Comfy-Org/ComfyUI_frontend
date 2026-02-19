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
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'

const { url } = defineProps<{
  url: string
}>()

const { copied } = useClipboard({ copiedDuring: 2000 })
const { copyToClipboard } = useCopyToClipboard()

async function handleCopy() {
  await copyToClipboard(url)
}
</script>
