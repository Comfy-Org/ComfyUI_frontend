<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { externalLinks, getRoutes } from '../../config/routes'
import BrandButton from './BrandButton.vue'
import MobileMenu from './MobileMenu.vue'
import NavDesktopLink from './NavDesktopLink.vue'
import type { NavLink } from './NavDesktopLink.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const routes = getRoutes(locale)

const navLinks: NavLink[] = [
  {
    label: t('nav.products', locale),
    items: [
      { label: t('nav.comfyLocal', locale), href: routes.download },
      { label: t('nav.comfyCloud', locale), href: routes.cloud },
      { label: t('nav.comfyApi', locale), href: routes.api, badge: 'NEW' },
      { label: t('nav.comfyEnterprise', locale), href: routes.cloudEnterprise }
    ]
  },
  { label: t('nav.pricing', locale), href: routes.cloudPricing },
  {
    label: t('nav.community', locale),
    items: [
      { label: t('nav.comfyHub', locale), href: externalLinks.workflows, badge: 'NEW' },
      { label: t('nav.gallery', locale), href: routes.gallery }
    ]
  },
  {
    label: t('nav.resources', locale),
    items: [
      { label: t('nav.blogs', locale), href: externalLinks.blog, external: true },
      { label: t('nav.github', locale), href: externalLinks.github, external: true },
      { label: t('nav.discord', locale), href: externalLinks.discord, external: true },
      { label: t('nav.docs', locale), href: externalLinks.docs, external: true },
      { label: t('nav.youtube', locale), href: externalLinks.youtube, external: true }
    ]
  },
  {
    label: t('nav.company', locale),
    items: [
      { label: t('nav.aboutUs', locale), href: routes.about },
      { label: t('nav.careers', locale), href: routes.careers },
      { label: t('nav.customerStories', locale), href: routes.customers }
    ]
  }
]

const ctaButtons = [
  { label: t('nav.downloadLocal', locale), href: routes.download, primary: false },
  { label: t('nav.launchCloud', locale), href: externalLinks.app, primary: true }
]

const currentPath = ref('')
const openDesktopDropdown = ref<string | null>(null)
const mobileMenuOpen = ref(false)

function closeMobileMenu() {
  mobileMenuOpen.value = false
}

function toggleDesktopDropdown(label: string) {
  openDesktopDropdown.value = openDesktopDropdown.value === label ? null : label
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    closeMobileMenu()
    openDesktopDropdown.value = null
  }
}

function onNavigate() {
  closeMobileMenu()
  openDesktopDropdown.value = null
  currentPath.value = window.location.pathname
}

function onMediaChange(e: MediaQueryListEvent) {
  if (e.matches) closeMobileMenu()
}

let mq: MediaQueryList

onMounted(() => {
  currentPath.value = window.location.pathname
  mq = window.matchMedia('(min-width: 768px)')
  mq.addEventListener('change', onMediaChange)
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('astro:after-swap', onNavigate)
})

onUnmounted(() => {
  mq?.removeEventListener('change', onMediaChange)
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('astro:after-swap', onNavigate)
})
</script>

<template>
  <MobileMenu :open="mobileMenuOpen" :links="navLinks" :cta-links="ctaButtons" @close="closeMobileMenu" />

  <nav
    class="bg-primary-comfy-ink fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-5 md:px-20 md:py-8"
    aria-label="Main navigation"
  >
    <a :href="routes.home" aria-label="Comfy home">
      <img
        src="/icons/logomark.svg"
        alt="Comfy"
        class="h-8 md:hidden"
      />
      <span
        class="hidden h-10 w-36 bg-contain bg-left bg-no-repeat md:block"
        style="background-image: url('/icons/logo.svg')"
        aria-hidden="true"
      />
    </a>

    <!-- Desktop nav links -->
    <div class="hidden items-center gap-10 md:flex">
      <NavDesktopLink
        v-for="link in navLinks"
        :key="link.label"
        :link="link"
        :current-path="currentPath"
        :is-open="openDesktopDropdown === link.label"
        @open="openDesktopDropdown = $event"
        @close="openDesktopDropdown = null"
        @toggle="toggleDesktopDropdown"
      />
    </div>

    <!-- Desktop CTA buttons -->
    <div class="hidden items-center gap-2 md:flex">
      <BrandButton
        v-for="cta in ctaButtons"
        :key="cta.href"
        :href="cta.href"
        :label="cta.label"
        :variant="cta.primary ? 'solid' : 'outline'"
        class-name="px-6 py-2.5"
      />
    </div>

    <!-- Mobile hamburger -->
    <button
      class="flex size-10 items-center justify-center rounded-xl md:hidden"
      :class="mobileMenuOpen
        ? 'border-primary-comfy-yellow border-2 bg-transparent'
        : 'bg-primary-comfy-yellow'"
      :aria-label="t('nav.toggleMenu', locale)"
      aria-controls="site-mobile-menu"
      :aria-expanded="mobileMenuOpen"
      @click="mobileMenuOpen = !mobileMenuOpen"
    >
      <img
        v-if="!mobileMenuOpen"
        src="/icons/breadthumb.svg"
        alt="Menu"
        class="h-3"
      />
      <img
        v-else
        src="/icons/close.svg"
        alt=""
        class="size-5"
        aria-hidden="true"
      />
    </button>
  </nav>
</template>
