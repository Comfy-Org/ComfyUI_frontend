<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import { LOCALES } from '@/config/locales'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { LocaleAlternate } from '@/lib/hreflang'

const { locale, alternates } = defineProps<{
  locale: Locale
  alternates: readonly LocaleAlternate[]
}>()
const { t } = translationsFor(locale)
</script>

<template>
  <nav v-if="alternates.length > 1" :aria-label="t('footer.language')">
    <ul class="flex items-center gap-4">
      <li v-for="alternate in alternates" :key="alternate.locale">
        <a
          :href="alternate.path"
          :hreflang="LOCALES[alternate.locale].hreflang"
          :lang="LOCALES[alternate.locale].hreflang"
          :aria-current="alternate.locale === locale ? 'page' : undefined"
          :class="
            cn(
              'text-sm transition-colors hover:text-primary-warm-white',
              alternate.locale === locale && 'underline underline-offset-4'
            )
          "
        >
          {{ LOCALES[alternate.locale].nativeName }}
        </a>
      </li>
    </ul>
  </nav>
</template>
