<template>
  <div class="flex items-center gap-2">
    <Input
      readonly
      :model-value="url"
      :aria-label="$t('shareWorkflow.shareUrlLabel')"
      class="flex-1"
      @focus="($event.target as HTMLInputElement).select()"
    />
    <Button
      variant="secondary"
      size="lg"
      class="font-normal"
      @click="handleCopy"
    >
      {{
        copied ? $t('shareWorkflow.linkCopied') : $t('shareWorkflow.copyLink')
      }}
      <i class="icon-[lucide--link] size-3.5" aria-hidden="true" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { refAutoReset } from '@vueuse/core'

import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import { useAppMode } from '@/composables/useAppMode'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { useTelemetry } from '@/platform/telemetry'

const { url } = defineProps<{
  url: string
}>()

const { copyToClipboard } = useCopyToClipboard()
const { isAppMode } = useAppMode()
const copied = refAutoReset(false, 2000)

async function handleCopy() {
  await copyToClipboard(url)
  copied.value = true
  useTelemetry()?.trackShareFlow({
    step: 'link_copied',
    source: isAppMode.value ? 'app_mode' : 'graph_mode'
  })
}
</script>
