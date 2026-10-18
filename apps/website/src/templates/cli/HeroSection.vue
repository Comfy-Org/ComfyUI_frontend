<script setup lang="ts">
import HeroSplit01 from '@/components/blocks/HeroSplit01.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import ComfyCliTerminal from './ComfyCliTerminal.vue'
import { cliCtas } from './ctas'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const ctas = cliCtas(locale)
</script>

<template>
  <div>
    <HeroSplit01
      :locale="locale"
      badge-text="CLI"
      :title="t('cli.hero.heading')"
      :subtitle="t('cli.hero.subtitle')"
      :primary-cta="ctas.installCli"
      :secondary-cta="ctas.docs"
      media-wrapper-class="order-last min-w-0"
    >
      <template #media>
        <ComfyCliTerminal :locale="locale" />
      </template>
    </HeroSplit01>
  </div>
</template>
