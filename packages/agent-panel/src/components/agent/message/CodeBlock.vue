<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@/utils/cn'

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

// watch (not watchEffect) so the code/lang deps are tracked even though the highlight body
// awaits the lazy shiki import — after the first await a watchEffect tracks nothing.
watch(
  () => [code, lang] as const,
  async ([currentCode, currentLang]) => {
    highlighted.value = null
    try {
      const { codeToHtml } = await import('shiki')
      highlighted.value = await codeToHtml(currentCode, {
        lang: currentLang,
        theme: 'github-dark',
        colorReplacements: { '#24292e': 'transparent' }
      })
    } catch {
      highlighted.value = null
    }
  },
  { immediate: true }
)
</script>

<template>
  <div
    class="group rounded-agent border-agent-border bg-agent-surface relative my-2 overflow-hidden border"
  >
    <div
      class="border-agent-border flex items-center justify-between border-b px-3 py-1.5"
    >
      <span class="text-agent-fg-subtle text-xs font-medium">{{ lang }}</span>
      <button
        type="button"
        class="text-agent-fg-subtle hover:text-agent-fg flex items-center gap-1 text-xs transition-colors"
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
      class="overflow-x-auto p-3 text-sm [&_pre]:bg-transparent"
      v-html="highlighted"
    />
    <pre
      v-else
      class="text-agent-fg overflow-x-auto p-3 text-sm"
    ><code>{{ code }}</code></pre>
  </div>
</template>
