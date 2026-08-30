<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

interface TerminalLine {
  kind: 'command' | 'success'
  text: string
}

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const lines: TerminalLine[] = [
  { kind: 'command', text: 'comfy deploy ./workflow_api.json' },
  { kind: 'success', text: t('platform.terminal.buildResolved', locale) },
  { kind: 'success', text: t('platform.terminal.deployed', locale) }
]
</script>

<template>
  <div
    class="overflow-hidden rounded-3xl border border-white/10 bg-[#2a222f] font-mono text-xs shadow-2xl"
  >
    <div class="flex items-center gap-1.5 px-5 py-3.5">
      <span class="size-3 rounded-full bg-white/15" />
      <span class="size-3 rounded-full bg-white/15" />
      <span class="size-3 rounded-full bg-white/15" />
    </div>
    <div
      class="scrollbar-none space-y-3 overflow-x-auto px-5 py-6 lg:px-6 lg:py-8"
    >
      <p
        v-for="line in lines"
        :key="line.text"
        class="flex items-start gap-2.5 text-primary-comfy-canvas"
      >
        <span
          class="text-primary-comfy-yellow shrink-0"
          aria-hidden="true"
          v-text="line.kind === 'command' ? '$' : '✔'"
        />
        <span class="lg:whitespace-nowrap">{{ line.text }}</span>
      </p>
    </div>
  </div>
</template>
