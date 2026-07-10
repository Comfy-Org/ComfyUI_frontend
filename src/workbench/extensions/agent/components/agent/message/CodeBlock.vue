<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

const { code, lang = 'text' } = defineProps<{
  code: string
  lang?: string
}>()

const { t } = useI18n()
const { copy, copied } = useClipboard({ copiedDuring: 2000, legacy: true })
</script>

<template>
  <div
    class="group border-agent-border-strong relative my-2 overflow-hidden rounded-md border"
  >
    <div
      class="border-agent-border-strong bg-agent-surface-hover flex items-center justify-between border-b px-3 py-1.5"
    >
      <span
        class="text-agent-fg-subtle flex items-center gap-1.5 font-mono text-xs"
      >
        <span class="icon-[lucide--file-code] size-3.5" />
        <span class="text-agent-fg font-medium">{{ lang }}</span>
      </span>
      <button
        type="button"
        class="text-agent-fg-subtle hover:bg-agent-surface hover:text-agent-fg border-agent-border-strong flex items-center gap-1 rounded-sm border px-2 py-0.5 font-mono text-xs transition-colors"
        @click="copy(code)"
      >
        <span
          :class="
            cn(
              'size-3.5',
              copied ? 'icon-[lucide--check]' : 'icon-[lucide--copy]'
            )
          "
        />
        {{ copied ? t('agent.copied') : t('agent.copy') }}
      </button>
    </div>
    <pre
      class="text-agent-fg overflow-x-auto p-4 font-mono text-sm"
    ><code>{{ code }}</code></pre>
  </div>
</template>
