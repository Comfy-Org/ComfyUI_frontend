<script setup lang="ts">
import HeroSplit01 from '../../components/blocks/HeroSplit01.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { platformCtas } from './ctas'
import PlatformHeroBadge from './PlatformHeroBadge.vue'
import ServerlessIsometricStudy from './ServerlessIsometricStudy.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const ctas = platformCtas(locale)
</script>

<template>
  <HeroSplit01
    :locale="locale"
    compact
    beta
    :badge-text="t('platform.hero.badge', locale)"
    :title="t('platform.products.serverless.title', locale)"
    title-class="sr-only"
    :subtitle="t('platform.products.serverless.description', locale)"
    :primary-cta="ctas.getStarted"
    :secondary-cta="ctas.docs"
    media-wrapper-class="hidden lg:block"
  >
    <template #badge>
      <PlatformHeroBadge :locale :status-label="t('nav.badgeBeta', locale)">
        <template #label>
          <img
            src="/icons/logo.svg"
            alt="Comfy"
            width="173"
            height="48"
            class="h-5 w-auto brightness-0 md:h-9"
          />
          <span>{{
            t('platform.products.serverless.badgeLabel', locale)
          }}</span>
        </template>
      </PlatformHeroBadge>
    </template>
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
