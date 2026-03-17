<script setup lang="ts">
import { computed } from 'vue'

import type { Locale } from '../i18n/translations'
import { t } from '../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const columns = computed(() => [
  {
    title: t('footer.product', locale),
    links: [
      { label: t('footer.comfyDesktop', locale), href: '/download' },
      { label: t('footer.comfyCloud', locale), href: 'https://app.comfy.org' },
      { label: t('footer.comfyHub', locale), href: 'https://hub.comfy.org' },
      { label: t('footer.pricing', locale), href: '/pricing' }
    ]
  },
  {
    title: t('footer.resources', locale),
    links: [
      {
        label: t('footer.documentation', locale),
        href: 'https://docs.comfy.org'
      },
      { label: t('footer.blog', locale), href: 'https://blog.comfy.org' },
      { label: t('footer.gallery', locale), href: '/gallery' },
      {
        label: t('footer.github', locale),
        href: 'https://github.com/comfyanonymous/ComfyUI'
      }
    ]
  },
  {
    title: t('footer.company', locale),
    links: [
      { label: t('footer.about', locale), href: '/about' },
      { label: t('footer.careers', locale), href: '/careers' },
      { label: t('footer.enterprise', locale), href: '/enterprise' }
    ]
  },
  {
    title: t('footer.legal', locale),
    links: [
      { label: t('footer.terms', locale), href: '/terms-of-service' },
      { label: t('footer.privacy', locale), href: '/privacy-policy' }
    ]
  }
])

const socials = [
  {
    label: 'GitHub',
    href: 'https://github.com/comfyanonymous/ComfyUI',
    icon: '/icons/social/github.svg'
  },
  {
    label: 'Discord',
    href: 'https://discord.gg/comfyorg',
    icon: '/icons/social/discord.svg'
  },
  {
    label: 'X',
    href: 'https://x.com/comaboratory',
    icon: '/icons/social/x.svg'
  },
  {
    label: 'Reddit',
    href: 'https://reddit.com/r/comfyui',
    icon: '/icons/social/reddit.svg'
  },
  {
    label: 'LinkedIn',
    href: 'https://linkedin.com/company/comfyorg',
    icon: '/icons/social/linkedin.svg'
  },
  {
    label: 'Instagram',
    href: 'https://instagram.com/comfyorg',
    icon: '/icons/social/instagram.svg'
  }
]
</script>

<template>
  <footer class="border-t border-white/10 bg-black">
    <div
      class="mx-auto grid max-w-7xl gap-8 px-6 py-16 sm:grid-cols-2 lg:grid-cols-5"
    >
      <!-- Brand -->
      <div class="lg:col-span-1">
        <a href="/" class="text-2xl font-bold text-brand-yellow italic">
          Comfy
        </a>
        <p class="mt-4 text-sm text-smoke-700">
          {{ t('footer.tagline', locale) }}
        </p>
      </div>

      <!-- Link columns -->
      <nav
        v-for="column in columns"
        :key="column.title"
        :aria-label="column.title"
        class="flex flex-col gap-3"
      >
        <h3 class="text-sm font-semibold text-white">{{ column.title }}</h3>
        <a
          v-for="link in column.links"
          :key="link.href"
          :href="link.href"
          :target="link.href.startsWith('http') ? '_blank' : undefined"
          :rel="
            link.href.startsWith('http') ? 'noopener noreferrer' : undefined
          "
          class="text-sm text-smoke-700 transition-colors hover:text-white"
        >
          {{ link.label }}
        </a>
      </nav>
    </div>

    <!-- Bottom bar -->
    <div class="border-t border-white/10">
      <div
        class="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 p-6 sm:flex-row"
      >
        <p class="text-sm text-smoke-700">
          &copy; {{ new Date().getFullYear() }}
          {{ t('footer.copyright', locale) }}
        </p>

        <!-- Social icons -->
        <div class="flex items-center gap-4">
          <a
            v-for="social in socials"
            :key="social.label"
            :href="social.href"
            :aria-label="social.label"
            target="_blank"
            rel="noopener noreferrer"
            class="text-smoke-700 transition-colors hover:text-white"
          >
            <span
              class="inline-block size-5 bg-current"
              :style="{
                maskImage: `url(${social.icon})`,
                maskSize: 'contain',
                maskRepeat: 'no-repeat',
                WebkitMaskImage: `url(${social.icon})`,
                WebkitMaskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat'
              }"
              aria-hidden="true"
            />
          </a>
        </div>
      </div>
    </div>
  </footer>
</template>
