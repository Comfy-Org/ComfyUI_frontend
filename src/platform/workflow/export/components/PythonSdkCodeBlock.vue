<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'

type CodePart = [text: string, className?: string]

const { filename } = defineProps<{ filename: string }>()
const { t } = useI18n()
const { copyToClipboard } = useCopyToClipboard()
const lines = computed<CodePart[][]>(() => [
  [['# pip install comfy-sdk', 'text-muted-foreground']],
  [],
  [
    ['from', 'text-destructive-background'],
    [' comfy_sdk '],
    ['import', 'text-destructive-background'],
    [' Comfy']
  ],
  [],
  [
    ['client = Comfy('],
    ['"http://127.0.0.1:8189"', 'text-primary-background'],
    [')']
  ],
  [
    ['workflow = client.workflows.from_file('],
    [JSON.stringify(filename), 'text-success-background'],
    [')']
  ],
  [['job = client.run(workflow)']]
])
const code = computed(() =>
  lines.value.map((line) => line.map(([text]) => text).join('')).join('\n')
)
</script>

<template>
  <div class="relative overflow-hidden rounded-lg bg-tertiary-background">
    <pre
      class="m-0 overflow-x-auto p-3 pr-12 font-mono text-xs/5 text-base-foreground"
      data-testid="python-sdk-code"
    ><code><span
      v-for="(line, lineIndex) in lines"
      :key="lineIndex"
      class="block min-h-5"
    ><span
      v-for="([text, className], partIndex) in line"
      :key="partIndex"
      :class="className"
      v-text="text"
    /></span></code></pre>
    <Button
      class="absolute top-1 right-1"
      size="icon-lg"
      variant="muted-textonly"
      :aria-label="t('g.copyToClipboard')"
      :title="t('g.copyToClipboard')"
      @click="copyToClipboard(code)"
    >
      <i class="icon-[lucide--copy] size-4" aria-hidden="true" />
    </Button>
  </div>
</template>
