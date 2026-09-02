<script setup lang="ts">
import { useClipboard, watchDebounced } from '@vueuse/core'
import { default as DOMPurify } from 'dompurify'
import { computed, ref } from 'vue'
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
const MAX_HIGHLIGHT_CHARS = 50_000
const highlighted = ref<{
  code: string
  lang: string
  html: string
} | null>(null)
const renderedHighlight = computed(() => {
  const snapshot = highlighted.value
  return snapshot?.code === code && snapshot.lang === lang
    ? snapshot.html
    : null
})

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
    if (currentCode.length > MAX_HIGHLIGHT_CHARS) {
      highlighted.value = null
      return
    }
    try {
      const { codeToHtml } = await import('shiki')
      const html = await codeToHtml(currentCode, {
        lang: currentLang,
        theme: 'github-dark',
        colorReplacements: { '#24292e': 'transparent' }
      })
      if (!cancelled)
        highlighted.value = {
          code: currentCode,
          lang: currentLang,
          html: DOMPurify.sanitize(html)
        }
    } catch {
      if (!cancelled) highlighted.value = null
    }
  },
  { immediate: true, debounce: 100, maxWait: 500 }
)
</script>

<template>
  <div
    class="border-border group relative my-2 overflow-hidden rounded-md border"
  >
    <div
      class="border-border flex items-center justify-between border-b bg-muted px-3 py-1.5"
    >
      <span
        class="flex items-center gap-1.5 font-mono text-xs text-muted-foreground"
      >
        <span class="icon-[lucide--file-code] size-3.5" />
        <span class="text-foreground font-medium">{{ lang }}</span>
      </span>
      <button
        type="button"
        class="hover:bg-background hover:text-foreground border-border flex items-center gap-1 rounded-sm border px-2 py-0.5 font-mono text-xs text-muted-foreground transition-colors"
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
      v-if="renderedHighlight"
      class="overflow-x-auto p-4 font-mono text-sm [&_pre]:bg-transparent"
      v-html="renderedHighlight"
    />
    <pre
      v-else
      class="text-foreground overflow-x-auto p-4 font-mono text-sm"
    ><code>{{ code }}</code></pre>
  </div>
</template>
