<script setup lang="ts">
import { ref } from 'vue'

import { useFrameScrub } from '../../composables/useFrameScrub'
import { externalLinks, getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import FooterLinkColumn from './FooterLinkColumn.vue'
import type { FooterLink } from './FooterLinkColumn.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const routes = getRoutes(locale)

const footerRef = ref<HTMLElement>()
const canvasRef = ref<HTMLCanvasElement>()

useFrameScrub(canvasRef, {
  frameCount: 73,
  frameSrc: (i) =>
    `/videos/footer-logo-seq/Logo${String(i).padStart(2, '0')}.webp`,
  scrollTrigger: (canvas) => ({
    trigger: canvas,
    start: 'top bottom',
    endTrigger: footerRef.value,
    end: 'bottom bottom',
    scrub: true
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
    { label: t('footer.privacyPolicy', locale), href: routes.privacyPolicy },
    { label: t('footer.support', locale), href: externalLinks.discord }
  ]
}

const contactSection = {
  title: t('footer.contact', locale),
  emails: ['hello@comfy.org', 'press@comfy.org']
}
</script>

<template>
  <footer
    ref="footerRef"
    class="bg-primary-comfy-ink text-primary-comfy-canvas px-6 py-8 lg:px-20"
  >
    <div
      class="border-primary-warm-gray flex flex-col gap-12 border-t pt-16 lg:gap-0"
    >
      <!-- Desktop: row layout / Mobile: column layout -->
      <div class="flex flex-col gap-12 lg:flex-row lg:gap-0">
        <!-- Left: tagline -->
        <div class="flex-1">
          <p class="text-2xl font-medium tracking-wide uppercase lg:text-3xl">
            {{ t('footer.tagline', locale) }}
          </p>
        </div>

        <!-- Right: link columns (desktop: 3-col, mobile: 2-col + company below) -->
        <div class="flex flex-1 flex-col gap-12">
          <!-- Mobile: 2-col grids -->
          <div class="grid grid-cols-2 gap-12 lg:hidden">
            <FooterLinkColumn
              v-for="column in topColumns"
              :key="column.title"
              :title="column.title"
              :links="column.links"
            />
          </div>
          <div class="grid grid-cols-2 gap-12 lg:hidden">
            <FooterLinkColumn
              :title="companyColumn.title"
              :links="companyColumn.links"
            />
            <div class="flex flex-col gap-4">
              <h3 class="text-sm font-bold">{{ contactSection.title }}</h3>
              <div class="flex flex-col">
                <a
                  v-for="email in contactSection.emails"
                  :key="email"
                  :href="`mailto:${email}`"
                  class="hover:text-primary-warm-white text-sm transition-colors"
                >
                  {{ email }}
                </a>
              </div>
            </div>
          </div>

          <!-- Desktop: all columns in a row -->
          <div class="hidden grid-cols-3 gap-12 lg:grid">
            <FooterLinkColumn
              v-for="column in [...topColumns, companyColumn]"
              :key="column.title"
              :title="column.title"
              :links="column.links"
            />
            <div class="col-start-3 flex flex-col gap-4">
              <h3 class="text-sm font-bold">{{ contactSection.title }}</h3>
              <div class="flex flex-col">
                <a
                  v-for="email in contactSection.emails"
                  :key="email"
                  :href="`mailto:${email}`"
                  class="hover:text-primary-warm-white text-sm transition-colors"
                >
                  {{ email }}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Logo + bottom bar -->
      <div
        class="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between"
      >
        <canvas ref="canvasRef" class="mt-12 size-52 opacity-80 lg:mt-24" />
        <div class="flex justify-center gap-6 lg:justify-end">
          <p class="text-sm">{{ t('footer.location', locale) }}</p>
          <p class="text-sm">&copy; {{ new Date().getFullYear() }} Comfy Org</p>
        </div>
      </div>
    </div>
  </footer>
</template>
