<script setup lang="ts">
import { useClipboard, watchDebounced } from '@vueuse/core'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import SanitizedHtml from '@/components/common/SanitizedHtml.vue'
import Button from '@/components/ui/button/Button.vue'

const { code, lang = 'text' } = defineProps<{
  code: string
  lang?: string
}>()

const { t } = useI18n()
const { copy, copied } = useClipboard({ copiedDuring: 2000, legacy: true })

const highlighted = ref<string | null>(null)

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
      if (!cancelled) highlighted.value = html
    } catch {
      if (!cancelled) highlighted.value = null
    }
  },
  { immediate: true, debounce: 100 }
)
</script>

<template>
  <div
    class="group relative my-2 overflow-hidden rounded-md border border-border-default"
  >
    <div
      class="flex items-center justify-between border-b border-border-default bg-secondary-background-hover px-3 py-1.5"
    >
      <span
        class="flex items-center gap-1.5 font-mono text-xs text-muted-foreground"
      >
        <span class="icon-[lucide--file-code] size-3.5" />
        <span class="text-base-foreground">{{ lang }}</span>
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        class="gap-1 font-mono"
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
      </Button>
    </div>
    <SanitizedHtml
      v-if="highlighted"
      profile="highlighted-code"
      class="overflow-x-auto p-4 font-mono text-sm [&_pre]:bg-transparent"
      :html="highlighted"
    />
    <pre
      v-else
      class="overflow-x-auto p-4 font-mono text-sm text-base-foreground"
    ><code>{{ code }}</code></pre>
  </div>
</template>
