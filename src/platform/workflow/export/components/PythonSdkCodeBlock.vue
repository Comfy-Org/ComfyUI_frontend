<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'

type TokenKind = 'comment' | 'keyword' | 'string' | 'url' | 'plain'

interface CodeToken {
  text: string
  kind: TokenKind
}

const TOKEN_CLASSES = {
  comment: 'text-code-comment-foreground',
  keyword: 'text-code-keyword-foreground',
  string: 'text-code-string-foreground',
  url: 'text-code-url-foreground',
  plain: 'text-base-foreground'
} satisfies Record<TokenKind, string>

const { filename } = defineProps<{
  filename: string
}>()

const { t } = useI18n()
const { copyToClipboard } = useCopyToClipboard()

const lines = computed<CodeToken[][]>(() => [
  [
    {
      text: '# pip install comfy-sdk',
      kind: 'comment'
    }
  ],
  [],
  [
    { text: 'from', kind: 'keyword' },
    { text: ' comfy_sdk ', kind: 'plain' },
    { text: 'import', kind: 'keyword' },
    { text: ' Comfy', kind: 'plain' }
  ],
  [],
  [
    { text: 'client = Comfy(', kind: 'plain' },
    { text: '"http://127.0.0.1:8189"', kind: 'url' },
    { text: ')', kind: 'plain' }
  ],
  [
    { text: 'workflow', kind: 'plain' },
    { text: ' = client.workflows.from_file(', kind: 'plain' },
    { text: JSON.stringify(filename), kind: 'string' },
    { text: ')', kind: 'plain' }
  ],
  [
    { text: 'job', kind: 'plain' },
    { text: ' = client.run(workflow)', kind: 'plain' }
  ]
])

const code = computed(() =>
  lines.value.map((line) => line.map((token) => token.text).join('')).join('\n')
)
</script>

<template>
  <div class="relative overflow-hidden rounded-lg bg-tertiary-background">
    <pre
      class="m-0 overflow-x-auto p-3 pr-12 font-mono text-xs/5"
      data-testid="python-sdk-code"
    ><code><span
      v-for="(line, lineIndex) in lines"
      :key="lineIndex"
      class="block min-h-5"
    ><span
      v-for="(token, tokenIndex) in line"
      :key="tokenIndex"
      :class="TOKEN_CLASSES[token.kind]"
    >{{ token.text }}</span></span></code></pre>
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
