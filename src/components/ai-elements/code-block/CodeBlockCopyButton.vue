<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'
import { computed, inject, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import TooltipContent from '@/components/ui/tooltip/TooltipContent.vue'
import TooltipTrigger from '@/components/ui/tooltip/TooltipTrigger.vue'

import { CodeBlockKey } from './context'

const { timeout = 2000, class: className } = defineProps<{
  timeout?: number
  class?: HTMLAttributes['class']
}>()

const emit = defineEmits<{
  copy: []
  error: [error: Error]
}>()

const { t } = useI18n()
const context = inject(CodeBlockKey)
if (!context)
  throw new Error('CodeBlockCopyButton must be used within a CodeBlock')

const { code } = context
const isCopied = ref(false)
let resetTimer: ReturnType<typeof setTimeout> | undefined

const label = computed(() => (isCopied.value ? t('g.copied') : t('g.copy')))

async function copyToClipboard() {
  if (!navigator?.clipboard?.writeText) {
    emit('error', new Error('Clipboard API not available'))
    return
  }
  try {
    await navigator.clipboard.writeText(code.value)
    isCopied.value = true
    emit('copy')
    clearTimeout(resetTimer)
    resetTimer = setTimeout(() => {
      isCopied.value = false
    }, timeout)
  } catch (error) {
    emit('error', error instanceof Error ? error : new Error('Copy failed'))
  }
}

onBeforeUnmount(() => clearTimeout(resetTimer))
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <Button
        :class="cn('shrink-0', className)"
        size="icon-sm"
        variant="muted-textonly"
        :aria-label="label"
        @click="copyToClipboard"
      >
        <i
          :class="isCopied ? 'icon-[lucide--check]' : 'icon-[lucide--copy]'"
          class="size-3.5"
        />
      </Button>
    </TooltipTrigger>
    <TooltipContent side="top">{{ label }}</TooltipContent>
  </Tooltip>
</template>
