<script setup lang="ts">
import { ref } from 'vue'

import { externalLinks, getRoutes } from '../../config/routes'
import { useFrameScrub } from '../../composables/useFrameScrub'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import FooterLinkColumn from './FooterLinkColumn.vue'
import type { FooterLink } from './FooterLinkColumn.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const routes = getRoutes(locale)

const footerRef = ref<HTMLElement>()
const canvasRef = ref<HTMLCanvasElement>()

const frameUrls = Array.from({ length: 75 }, (_, i) => {
  const index = String(i).padStart(5, '0')
  return `https://media.comfy.org/website/homepage/footer-logo-seq/seq-footer_${index}.webp`
})

useFrameScrub(canvasRef, {
  urls: frameUrls,
  scrollTrigger: (canvas) => ({
    trigger: canvas,
    start: 'top bottom',
    endTrigger: footerRef.value,
    end: 'bottom bottom',
    scrub: 1
  })
})

const topColumns: { title: string; links: FooterLink[] }[] = [
  {
    title: t('footer.products', locale),
    links: [
      { label: t('nav.comfyLocal', locale), href: routes.download },
      { label: t('nav.comfyCloud', locale), href: routes.cloud },
      { label: t('nav.comfyApi', locale), href: routes.api },
      { label: t('nav.comfyEnterprise', locale), href: routes.cloudEnterprise }
    ]
  },
  {
    title: t('footer.resources', locale),
    links: [
      {
        label: t('footer.blog', locale),
        href: externalLinks.blog,
        external: true
      },
      {
        label: t('nav.discord', locale),
        href: externalLinks.discord,
        external: true
      },
      {
        label: t('nav.github', locale),
        href: externalLinks.github,
        external: true
      },
      {
        label: t('nav.docs', locale),
        href: externalLinks.docs,
        external: true
      },
      {
        label: t('nav.youtube', locale),
        href: externalLinks.youtube,
        external: true
      }
    ]
  }
]

const companyColumn: { title: string; links: FooterLink[] } = {
  title: t('footer.company', locale),
  links: [
    { label: t('footer.about', locale), href: routes.about },
    { label: t('nav.careers', locale), href: routes.careers },
    { label: t('footer.termsOfService', locale), href: routes.termsOfService },
    { label: t('footer.privacyPolicy', locale), href: routes.privacyPolicy }
  ]
}

const contactColumn = {
  title: t('footer.contact', locale),
  links: [
    { label: t('footer.sales', locale), href: routes.contact },
    {
      label: t('footer.support', locale),
      href: externalLinks.discord,
      external: true
    },
    { label: t('footer.press', locale), href: 'mailto:press@comfy.org' }
  ]
}
</script>

<template>
  <footer
    ref="footerRef"
    class="bg-primary-comfy-ink text-primary-comfy-canvas px-6 py-8 lg:px-20"
  >
    <div
      class="border-primary-warm-gray grid gap-12 border-t pt-16 lg:grid-cols-2 lg:gap-4"
    >
      <!-- Tagline -->
      <p class="text-2xl font-medium tracking-wide uppercase lg:text-3xl">
        {{ t('footer.tagline', locale) }}
      </p>

      <!-- Link columns -->
      <div class="flex flex-col gap-12 lg:row-span-2 lg:justify-between">
        <!-- Mobile: 2×2 grid -->
        <div class="flex flex-col gap-12 lg:hidden">
          <div class="grid grid-cols-2 gap-12">
            <FooterLinkColumn
              v-for="column in topColumns"
              :key="column.title"
              :title="column.title"
              :links="column.links"
            />
          </div>
          <div class="grid grid-cols-2 gap-12">
            <FooterLinkColumn
              :title="companyColumn.title"
              :links="companyColumn.links"
            />
            <FooterLinkColumn
              :title="contactColumn.title"
              :links="contactColumn.links"
            />
          </div>
        </div>

        <!-- Desktop: 3-col, Company+Contact merged -->
        <div class="hidden grid-cols-3 gap-12 lg:grid">
          <FooterLinkColumn
            v-for="column in topColumns"
            :key="column.title"
            :title="column.title"
            :links="column.links"
          />
          <div class="flex flex-col gap-10">
            <FooterLinkColumn
              :title="companyColumn.title"
              :links="companyColumn.links"
            />
            <FooterLinkColumn
              :title="contactColumn.title"
              :links="contactColumn.links"
            />
          </div>
        </div>

        <!-- Bottom bar -->
        <div class="flex justify-center gap-6 lg:justify-end">
          <p class="text-sm">{{ t('footer.location', locale) }}</p>
          <p class="text-sm">&copy; {{ new Date().getFullYear() }} Comfy Org</p>
        </div>
      </div>

      <!-- Logo -->
      <canvas
        ref="canvasRef"
        class="pointer-events-none size-52 opacity-80 lg:mt-28"
      />
    </div>
  </footer>
</template>
