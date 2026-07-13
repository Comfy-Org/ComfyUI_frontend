<script setup lang="ts">
import { computed } from 'vue'

import type { Locale } from '../../i18n/translations'

import { externalLinks, getRoutes } from '../../config/routes'
import { t } from '../../i18n/translations'
import HeroBackdrop01 from '../blocks/HeroBackdrop01.vue'
import Button from '../ui/button/Button.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = computed(() => getRoutes(locale))

const backdrop = {
  type: 'video',
  src: 'https://media.comfy.org/website/vfx/vfx_hero.mp4'
} as const

const mobileBackdrop = {
  type: 'video',
  src: 'https://media.comfy.org/website/vfx/vfx_hero-mobile.mp4'
} as const
</script>

<template>
  <HeroBackdrop01
    tone="dark"
    :backdrop="backdrop"
    :mobile-backdrop="mobileBackdrop"
    :title="t('vfx.hero.title', locale)"
    :subtitle="t('vfx.hero.subtitle', locale)"
  >
    <div class="mt-10 flex flex-wrap gap-4">
      <Button as="a" :href="routes.contact">
        {{ t('vfx.cta.contactSales', locale) }}
      </Button>
      <Button as="a" :href="externalLinks.cloud" variant="outline">
        {{ t('vfx.hero.tryNow', locale) }}
      </Button>
    </div>
  </HeroBackdrop01>
</template>
