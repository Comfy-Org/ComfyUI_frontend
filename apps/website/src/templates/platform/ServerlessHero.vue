<script setup lang="ts">
import HeroSplit01 from '../../components/blocks/HeroSplit01.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { platformCtas } from './ctas'
import ServerlessIsometricStudy from './ServerlessIsometricStudy.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const ctas = platformCtas(locale)
</script>

<template>
  <HeroSplit01
    :locale="locale"
    compact
    :title="t('platform.serverlessHero.heading', locale)"
    title-class="text-primary-comfy-yellow text-3xl/tight font-bold tracking-[-1.44px] md:text-4xl/tight lg:text-5xl/tight"
    :subtitle="t('platform.serverlessHero.subtitle', locale)"
    :primary-cta="ctas.getStarted"
    :secondary-cta="ctas.docs"
    media-wrapper-class="hidden lg:block"
  >
    <template #aboveCtas>
      <div class="mt-8 rounded-3xl lg:hidden">
        <ServerlessIsometricStudy :locale />
      </div>
    </template>
    <template #media>
      <ServerlessIsometricStudy :locale />
    </template>
  </HeroSplit01>
</template>
