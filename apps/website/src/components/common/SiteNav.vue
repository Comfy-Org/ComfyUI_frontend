<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import {
  breakpointsTailwind,
  useBreakpoints,
  useEventListener,
  whenever
} from '@vueuse/core'
import { nextTick, onMounted, ref } from 'vue'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { externalLinks, getRoutes } from '../../config/routes'
import BrandButton from './BrandButton.vue'
import GitHubStarBadge from './GitHubStarBadge.vue'
import MobileMenu from './MobileMenu.vue'
import NavDesktopLink from './NavDesktopLink.vue'
import type { NavLink } from './NavDesktopLink.vue'

const { locale = 'en', githubStars = '' } = defineProps<{
  locale?: Locale
  githubStars?: string
}>()
const routes = getRoutes(locale)

const navLinks: NavLink[] = [
  {
    label: t('nav.products', locale),
    items: [
      { label: t('nav.comfyLocal', locale), href: routes.download },
      { label: t('nav.comfyCloud', locale), href: routes.cloud },
      {
        label: t('nav.comfyApi', locale),
        href: routes.api,
        badge: t('nav.badgeNew', locale)
      },
      { label: t('nav.comfyEnterprise', locale), href: routes.cloudEnterprise }
    ]
  },
  { label: t('nav.pricing', locale), href: routes.cloudPricing },
  {
    label: t('nav.community', locale),
    items: [
      {
        label: t('nav.comfyHub', locale),
        href: externalLinks.workflows,
        badge: t('nav.badgeNew', locale)
      },
      { label: t('nav.gallery', locale), href: routes.gallery }
    ]
  },
  {
    label: t('nav.resources', locale),
    items: [
      {
        label: t('nav.blog', locale),
        href: externalLinks.blog,
        external: true
      },
      {
        label: t('nav.github', locale),
        href: externalLinks.github,
        external: true
      },
      {
        label: t('nav.discord', locale),
        href: externalLinks.discord,
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
  {
    label: t('nav.downloadLocal', locale),
    prefix: 'DOWNLOAD',
    core: 'LOCAL',
    href: routes.download,
    primary: false
  },
  {
    label: t('nav.launchCloud', locale),
    prefix: 'LAUNCH',
    core: 'CLOUD',
    href: externalLinks.cloud,
    primary: true
  }
]

const currentPath = ref('')
const openDesktopDropdown = ref<string | null>(null)
const mobileMenuOpen = ref(false)
const isNavigating = ref(false)
const hamburgerRef = ref<HTMLButtonElement | undefined>()

function closeMobileMenu() {
  mobileMenuOpen.value = false
  hamburgerRef.value?.focus()
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

async function onNavigate() {
  isNavigating.value = true
  closeMobileMenu()
  openDesktopDropdown.value = null
  currentPath.value = window.location.pathname
  await nextTick()
  isNavigating.value = false
}

const breakpoints = useBreakpoints(breakpointsTailwind)
const isDesktop = breakpoints.greaterOrEqual('lg')

whenever(isDesktop, () => {
  mobileMenuOpen.value = false
  // Don't focus hamburger when transitioning to desktop — it's hidden
})

onMounted(() => {
  currentPath.value = window.location.pathname
  useEventListener(document, 'keydown', onKeydown)
  useEventListener(document, 'astro:after-swap', onNavigate)
})
</script>

<template>
  <MobileMenu
    :open="mobileMenuOpen"
    :navigating="isNavigating"
    :links="navLinks"
    :cta-links="ctaButtons"
    :locale="locale"
    @close="closeMobileMenu"
  />

  <nav
    class="bg-primary-comfy-ink fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-4 px-6 py-5 lg:gap-4 lg:px-[clamp(0.25rem,4vw,5rem)] lg:py-8"
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
    <div
      data-testid="desktop-nav-links"
      class="hidden items-center gap-[clamp(1rem,2.5vw,2.5rem)] lg:flex"
    >
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
    <div
      data-testid="desktop-nav-cta"
      class="hidden shrink-0 items-center gap-2 lg:flex"
    >
      <GitHubStarBadge v-if="githubStars" :stars="githubStars" />
      <BrandButton
        v-for="cta in ctaButtons"
        :key="cta.href"
        :href="cta.href"
        :variant="cta.primary ? 'solid' : 'outline'"
        size="nav"
        :aria-label="cta.label"
      >
        <span
          class="inline-block max-w-0 overflow-hidden align-bottom transition-[max-width] duration-300 ease-in-out xl:max-w-28"
          aria-hidden="true"
          >{{ cta.prefix }}&nbsp;</span
        >{{ cta.core }}
      </BrandButton>
    </div>

    <!-- Mobile hamburger -->
    <button
      ref="hamburgerRef"
      :class="
        cn(
          'flex size-10 items-center justify-center rounded-xl lg:hidden',
          mobileMenuOpen
            ? 'border-primary-comfy-yellow border-2 bg-transparent'
            : 'bg-primary-comfy-yellow'
        )
      "
      :aria-label="t('nav.toggleMenu', locale)"
      aria-controls="site-mobile-menu"
      :aria-expanded="mobileMenuOpen"
      @click="mobileMenuOpen = !mobileMenuOpen"
    >
      <img
        v-if="!mobileMenuOpen"
        src="/icons/breadthumb.svg"
        alt=""
        class="h-3"
        aria-hidden="true"
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
