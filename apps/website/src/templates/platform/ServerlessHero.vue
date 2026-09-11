<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'

import HeroSplit01 from '../../components/blocks/HeroSplit01.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { platformCtas } from './ctas'
import ServerlessIsometricStudy from './ServerlessIsometricStudy.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const ctas = platformCtas(locale)
const desktop = useMediaQuery('(min-width: 1024px)', { ssrWidth: 1024 })
</script>

<template>
  <HeroSplit01
    :locale="locale"
    compact
    :title="t('platform.serverlessHero.heading', locale)"
    title-class="text-primary-comfy-yellow text-3xl/tight font-light tracking-normal md:text-4xl/tight lg:text-5xl/tight"
    :subtitle="t('platform.serverlessHero.subtitle', locale)"
    :primary-cta="ctas.getStarted"
    :secondary-cta="ctas.docs"
    media-wrapper-class="hidden lg:block"
  >
    <template #aboveCtas>
      <div class="mt-8 rounded-3xl lg:hidden">
        <ServerlessIsometricStudy v-if="!desktop" :locale />
      </div>
    </template>
    <template #media>
      <ServerlessIsometricStudy v-if="desktop" :locale />
    </template>
  </HeroSplit01>
</template>
