<script setup lang="ts">
import { externalLinks } from '@/config/routes'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const { locale } = defineProps<{ locale: Locale }>()
const { t } = translationsFor(locale)

const socialLinks = (
  [
    ['nav.github', externalLinks.github, 'github'],
    ['nav.discord', externalLinks.discord, 'discord'],
    ['nav.x', externalLinks.x, 'x'],
    ['nav.youtube', externalLinks.youtube, 'youtube'],
    ['nav.linkedin', externalLinks.linkedin, 'linkedin'],
    ['nav.instagram', externalLinks.instagram, 'instagram']
  ] as const
).map(([key, href, icon]) => ({
  label: t(key),
  href,
  icon: `/icons/social/${icon}.svg`
}))
</script>

<template>
  <nav :aria-label="t('footer.social')" class="shrink-0">
    <ul class="flex gap-5">
      <li v-for="link in socialLinks" :key="link.href">
        <a
          :href="link.href"
          target="_blank"
          rel="noopener"
          class="-m-2 block p-2 transition-colors hover:text-primary-warm-white"
        >
          <span
            class="block size-5 icon-mask"
            :style="{ maskImage: `url('${link.icon}')` }"
            aria-hidden="true"
          />
          <span class="sr-only">
            {{ link.label }} ({{ t('nav.opensInNewTab') }})
          </span>
        </a>
      </li>
    </ul>
  </nav>
</template>
