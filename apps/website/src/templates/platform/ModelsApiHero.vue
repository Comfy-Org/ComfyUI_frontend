<script setup lang="ts">
import HeroSplit01 from '../../components/blocks/HeroSplit01.vue'
import { externalLinks } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import CodeTabs from './CodeTabs.vue'
import { modelsApiCodeTabs } from './codeSamples'
import { platformCtas } from './ctas'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const ctas = platformCtas(locale)
</script>

<template>
  <HeroSplit01
    :locale="locale"
    compact
    :title="t('platform.modelsHero.heading', locale)"
    title-class="text-primary-comfy-yellow text-3xl/tight font-bold tracking-[-1.44px] md:text-4xl/tight lg:text-5xl/tight"
    media-wrapper-class="hidden min-w-0 lg:block"
    :subtitle="t('platform.modelsHero.subtitle', locale)"
    :primary-cta="{
      label: ctas.getStarted.label,
      href: externalLinks.docsComfyRouter,
      target: '_blank'
    }"
  >
    <template #aboveCtas>
      <div class="mt-8 lg:hidden">
        <CodeTabs
          :tabs="modelsApiCodeTabs"
          :label="t('platform.products.models.title', locale)"
          content-class="bg-[#2a2230]"
        />
      </div>
    </template>
    <template #media>
      <CodeTabs
        :tabs="modelsApiCodeTabs"
        :label="t('platform.products.models.title', locale)"
        content-class="bg-[#2a2230]"
      />
    </template>
  </HeroSplit01>
</template>
