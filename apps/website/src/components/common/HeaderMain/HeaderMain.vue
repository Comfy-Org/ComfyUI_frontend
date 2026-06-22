<script setup lang="ts">
import type { Locale } from '../../../i18n/translations.ts'
import { t } from '../../../i18n/translations.ts'
import { externalLinks, getRoutes } from '../../../config/routes.ts'
import type { CtaButton } from '../../../scripts/posthog'
import { captureCtaClick } from '../../../scripts/posthog'
import GitHubStarBadge from '../GitHubStarBadge.vue'
import HeaderMainDesktop from './HeaderMainDesktop.vue'
import HeaderMainMobile from './HeaderMainMobile.vue'
import Button from '@/components/ui/button/Button.vue'

const { locale = 'en', githubStars = '' } = defineProps<{
  locale?: Locale
  githubStars?: string
}>()
const routes = getRoutes(locale)

const ctaButtons: {
  prefix: string
  core: string
  ariaLabel: string
  href: string
  primary: boolean
  ctaButton: CtaButton
}[] = [
  {
    prefix: t('nav.ctaDesktopPrefix', locale),
    core: t('nav.ctaDesktopCore', locale),
    ariaLabel: t('nav.downloadLocal', locale),
    href: routes.download,
    primary: false,
    ctaButton: 'download_desktop'
  },
  {
    prefix: t('nav.ctaCloudPrefix', locale),
    core: t('nav.ctaCloudCore', locale),
    ariaLabel: t('nav.launchCloud', locale),
    href: externalLinks.cloud,
    primary: true,
    ctaButton: 'launch_cloud'
  }
]
</script>

<template>
  <nav
    class="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-4 bg-primary-comfy-ink px-6 py-5 lg:gap-4 lg:px-[clamp(0.25rem,4vw,5rem)] lg:py-8"
    aria-label="Main navigation"
  >
    <a
      :href="routes.home"
      class="inline-grid h-10 shrink-0 grid-cols-1 grid-rows-1 transition-[width]"
      aria-label="Comfy home"
    >
      <img
        src="/icons/logomark.svg"
        alt="Comfy"
        class="col-span-full row-span-full h-8"
      />
      <div
        class="relative col-span-full row-span-full h-10 w-0 overflow-clip transition-[width] xl:w-36"
      >
        <img
          src="/icons/logo.svg"
          alt="Comfy"
          class="absolute top-0 left-0 h-10 w-36 max-w-none object-contain object-left"
        />
      </div>
    </a>

    <!-- Desktop nav links -->
    <HeaderMainDesktop :locale class="hidden lg:block" />
    <HeaderMainMobile :locale class="lg:hidden" />

    <!-- Desktop CTA buttons -->
    <div
      data-testid="desktop-nav-cta"
      class="hidden shrink-0 items-center gap-2 lg:flex"
    >
      <GitHubStarBadge v-if="githubStars" :stars="githubStars" />
      <Button
        v-for="cta in ctaButtons"
        :key="cta.href"
        as="a"
        :href="cta.href"
        :variant="cta.primary ? 'default' : 'outline'"
        :aria-label="cta.ariaLabel"
        @click="captureCtaClick(cta.ctaButton, 'nav')"
      >
        <span
          ><span class="hidden xl:inline-block">{{ cta.prefix }}&nbsp;</span
          >{{ cta.core }}</span
        >
      </Button>
    </div>
  </nav>
</template>
