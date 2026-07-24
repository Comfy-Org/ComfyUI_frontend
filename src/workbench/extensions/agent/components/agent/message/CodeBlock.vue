<script setup lang="ts">
import { useClipboard, watchDebounced } from '@vueuse/core'
import { default as DOMPurify } from 'dompurify'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

const { code, lang = 'text' } = defineProps<{
  code: string
  lang?: string
}>()

const { t } = useI18n()
const { copy, copied } = useClipboard({ copiedDuring: 2000, legacy: true })

// shiki highlights asynchronously and its bundle is lazy-loaded, so the block first
// renders as plain escaped code and swaps to the highlighted markup once shiki resolves.
// An unknown language (or a shiki failure) degrades to the plain fallback rather than
// throwing. shiki emits its own trusted <span> markup, safe to inject.
const highlighted = ref<string | null>(null)

// watchDebounced (not watchEffect) so the code/lang deps are tracked even though the highlight
// body awaits the lazy shiki import, and streaming token bursts collapse into one re-highlight.
// The previous highlight stays visible until the next one resolves, so the block never flashes
// back to plain mid-stream.
watchDebounced(
  () => [code, lang] as const,
  async ([currentCode, currentLang], _prev, onCleanup) => {
    let cancelled = false
    onCleanup(() => {
      cancelled = true
    })
    try {
      const { codeToHtml } = await import('shiki')
      const html = await codeToHtml(currentCode, {
        lang: currentLang,
        theme: 'github-dark',
        colorReplacements: { '#24292e': 'transparent' }
      })
      if (!cancelled) highlighted.value = DOMPurify.sanitize(html)
    } catch {
      if (!cancelled) highlighted.value = null
    }
  },
  { immediate: true, debounce: 100 }
)
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
    <div
      v-if="highlighted"
      class="overflow-x-auto p-4 font-mono text-sm [&_pre]:bg-transparent"
      v-html="highlighted"
    />
    <pre
      v-else
      class="text-agent-fg overflow-x-auto p-4 font-mono text-sm"
    ><code>{{ code }}</code></pre>
  </div>
</template>
