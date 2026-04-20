<script setup lang="ts">
import { ref } from 'vue'

import { useIntersectionObserver } from '@vueuse/core'

import { externalLinks, getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import FooterLinkColumn from './FooterLinkColumn.vue'
import type { FooterLink } from './FooterLinkColumn.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const routes = getRoutes(locale)

const videoRef = ref<HTMLVideoElement>()

const { stop } = useIntersectionObserver(videoRef, ([entry]) => {
  if (entry?.isIntersecting && videoRef.value) {
    videoRef.value.playbackRate = 5
    videoRef.value.play()
    stop()
  }
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

const contactColumn = {
  title: t('footer.contact', locale),
  links: ['hello@comfy.org', 'press@comfy.org'].map((email) => ({
    label: email,
    href: `mailto:${email}`
  }))
}
</script>

<template>
  <footer
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
            <FooterLinkColumn
              :title="contactColumn.title"
              :links="contactColumn.links"
            />
          </div>

          <!-- Desktop: all columns in a row -->
          <div class="hidden grid-cols-4 gap-12 lg:grid">
            <FooterLinkColumn
              v-for="column in [...topColumns, companyColumn, contactColumn]"
              :key="column.title"
              :title="column.title"
              :links="column.links"
            />
          </div>
        </div>
      </div>

      <!-- Logo + bottom bar -->
      <div
        class="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between"
      >
        <video
          ref="videoRef"
          src="https://media.comfy.org/website/homepage/footer-logo-seq.webm"
          muted
          playsinline
          preload="auto"
          class="mt-12 size-52 opacity-80 lg:mt-24"
        />
        <div class="flex justify-center gap-6 lg:justify-end">
          <p class="text-sm">{{ t('footer.location', locale) }}</p>
          <p class="text-sm">&copy; {{ new Date().getFullYear() }} Comfy Org</p>
        </div>
      </div>
    </div>
  </footer>
</template>
