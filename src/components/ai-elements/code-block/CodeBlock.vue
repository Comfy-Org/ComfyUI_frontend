<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed, provide } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import CodeBlockContainer from './CodeBlockContainer.vue'
import CodeBlockContent from './CodeBlockContent.vue'
import { CodeBlockKey } from './context'

const {
  code,
  language,
  showLineNumbers = false,
  class: className
} = defineProps<{
  code: string
  language: string
  showLineNumbers?: boolean
  class?: HTMLAttributes['class']
}>()

provide(CodeBlockKey, { code: computed(() => code) })
</script>

<template>
  <CodeBlockContainer :class="cn('text-xs', className)" :language="language">
    <slot />
    <CodeBlockContent
      :code="code"
      :language="language"
      :show-line-numbers="showLineNumbers"
    />
  </CodeBlockContainer>
</template>
