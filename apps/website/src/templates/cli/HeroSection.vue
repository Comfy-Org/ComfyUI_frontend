<script setup lang="ts">
import HeroSplit01 from '../../components/blocks/HeroSplit01.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import ComfyCliTerminal from './ComfyCliTerminal.vue'
import { cliCtas } from './ctas'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const ctas = cliCtas(locale)

// TODO(asset): replace the wordmark row with client logo SVGs (monochrome,
// ~24px tall) once trademark-cleared assets exist for each client.
const clients = [
  'Claude Code',
  'Codex',
  'Cursor',
  'Gemini CLI',
  'OpenClaw',
  'Hermes',
  t('cli.hero.clientAnyShell', locale)
]
</script>

<template>
  <div>
    <!-- 5rem/6.75rem = HeaderMain's rendered height (py-5 / lg:py-8) so the hero fills the viewport below the sticky nav -->
    <HeroSplit01
      :locale="locale"
      class="min-h-[calc(100svh-5rem)] lg:min-h-[calc(100svh-6.75rem)]"
      badge-text="CLI"
      :title="t('cli.hero.heading', locale)"
      :subtitle="t('cli.hero.subtitle', locale)"
      :primary-cta="ctas.installCli"
      :secondary-cta="ctas.docs"
    >
      <template #media>
        <ComfyCliTerminal :locale="locale" />
      </template>
    </HeroSplit01>

    <div class="max-w-9xl mx-auto px-6 pb-16 lg:px-16">
      <div
        class="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-white/10 pt-8"
      >
        <p
          class="text-xs font-bold tracking-widest text-white/40 uppercase lg:text-sm"
        >
          {{ t('cli.hero.clientsLabel', locale) }}
        </p>
        <p
          v-for="client in clients"
          :key="client"
          class="font-formula text-sm font-extrabold tracking-[0.7px] text-white/60 uppercase lg:text-base"
        >
          {{ client }}
        </p>
      </div>
    </div>
  </div>
</template>
