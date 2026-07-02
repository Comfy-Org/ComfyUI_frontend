<script setup lang="ts">
import type { BundledLanguage, ThemedToken } from 'shiki'
import { cn } from '@comfyorg/tailwind-utils'
import { computed, ref, watch } from 'vue'

import type { TokenizedCode } from './utils'
import {
  createRawTokens,
  highlightCode,
  isBold,
  isItalic,
  isUnderline
} from './utils'

const {
  code,
  language,
  showLineNumbers = false
} = defineProps<{
  code: string
  language: string
  showLineNumbers?: boolean
}>()

const rawTokens = computed(() => createRawTokens(code))
const tokenized = ref<TokenizedCode>(
  highlightCode(code, language as BundledLanguage) ?? rawTokens.value
)

watch(
  () => [code, language],
  () => {
    tokenized.value =
      highlightCode(code, language as BundledLanguage) ?? rawTokens.value
    highlightCode(code, language as BundledLanguage, (result) => {
      tokenized.value = result
    })
  },
  { immediate: true }
)

const preStyle = computed(() => ({
  color: tokenized.value.fg
}))

interface KeyedToken {
  token: ThemedToken
  key: string
}
interface KeyedLine {
  tokens: KeyedToken[]
  key: string
}

const keyedLines = computed<KeyedLine[]>(() =>
  tokenized.value.tokens.map((line, lineIdx) => ({
    key: `line-${lineIdx}`,
    tokens: line.map((token, tokenIdx) => ({
      token,
      key: `line-${lineIdx}-${tokenIdx}`
    }))
  }))
)

const lineNumberClasses = cn(
  'block',
  'before:content-[counter(line)]',
  'before:inline-block',
  'before:[counter-increment:line]',
  'before:w-8',
  'before:mr-4',
  'before:text-right',
  'before:text-muted-foreground/50',
  'before:font-mono',
  'before:select-none'
)
</script>

<template>
  <div class="relative overflow-auto">
    <pre
      class="m-0 overflow-auto bg-base-background p-4 text-sm"
      :style="preStyle"
    ><code
        :class="
          cn(
            'font-mono text-sm',
            showLineNumbers && '[counter-increment:line_0] [counter-reset:line]',
          )
        "
      ><template v-for="line in keyedLines" :key="line.key"><span :class="showLineNumbers ? lineNumberClasses : 'block'"><span
                v-for="tokenObj in line.tokens"
                :key="tokenObj.key"
                :style="{
                  color: tokenObj.token.color,
                  backgroundColor: tokenObj.token.bgColor,
                  fontStyle: isItalic(tokenObj.token.fontStyle) ? 'italic' : undefined,
                  fontWeight: isBold(tokenObj.token.fontStyle) ? 'bold' : undefined,
                  textDecoration: isUnderline(tokenObj.token.fontStyle)
                    ? 'underline'
                    : undefined,
                }"
              >{{ tokenObj.token.content }}</span></span></template></code></pre>
  </div>
</template>
