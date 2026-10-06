<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { ref } from 'vue'

import { externalLinks, getRoutes } from '@/config/routes'
import { useFrameScrub } from '@/composables/useFrameScrub'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { getSocialLinks } from '@/data/socialLinks'
import FooterLinkColumn from './FooterLinkColumn.vue'
import type { FooterLink } from './FooterLinkColumn.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)
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
    title: t('footer.products'),
    links: [
      {
        label: t('nav.comfyLocal'),
        href: routes.download
      },
      {
        label: t('nav.comfyCloud'),
        href: routes.cloud
      },
      {
        label: t('nav.developerPlatform'),
        href: routes.platform
      },
      {
        label: t('nav.comfyEnterprise'),
        href: routes.enterprise
      },
      { label: t('nav.pricing'), href: routes.pricing },
      { label: t('nav.mcpServer'), href: routes.mcp },
      {
        label: t('nav.comfyAgent'),
        href: routes.agent
      },
      { label: t('nav.comfyCli'), href: routes.cli }
    ]
  },
  {
    title: t('footer.models'),
    links: [
      {
        label: t('footer.modelCatalogue'),
        href: routes.workshop
      },
      {
        label: t('nav.supportedModels'),
        href: routes.models
      },
      {
        label: t('footer.minimaxH3'),
        href: routes.minimax
      },
      {
        label: t('footer.minimaxMusic3'),
        href: routes.minimaxMusic3
      },
      {
        label: t('footer.minimaxLicense'),
        href: routes.minimaxLicense
      },
      {
        label: t('footer.seedance'),
        href: routes.seedance
      },
      {
        label: t('footer.wanAnimate2'),
        href: routes.wanAnimate2
      },
      { label: t('footer.ltx'), href: routes.ltx },
      {
        label: t('footer.geminiOmni'),
        href: routes.geminiOmni
      },
      { label: t('footer.wan3'), href: routes.wan3 },
      {
        label: t('footer.chatgptImage25'),
        href: routes.chatgptImage25
      },
      {
        label: t('footer.qwenImage21'),
        href: routes.qwenImage21
      },
      { label: t('footer.flux3'), href: routes.flux3 }
    ]
  },
  {
    title: t('footer.resources'),
    links: [
      {
        label: t('nav.learning'),
        href: routes.learning
      },
      {
        label: t('nav.customerStories'),
        href: routes.customers
      },
      {
        label: t('footer.workflows'),
        href: externalLinks.workflows
      },
      {
        label: t('footer.useCases'),
        href: externalLinks.workflowUseCases
      },
      {
        label: t('nav.launches'),
        href: routes.launches
      },
      { label: t('nav.fdct'), href: routes.fdct },
      {
        label: t('footer.blog'),
        href: externalLinks.blog,
        external: true
      },
      {
        label: t('nav.docs'),
        href: externalLinks.docs,
        external: true
      },
      {
        label: t('footer.affiliateProgram'),
        href: routes.affiliates
      }
    ]
  },
  {
    title: t('footer.company'),
    links: [
      { label: t('footer.about'), href: routes.about },
      { label: t('nav.careers'), href: routes.careers },
      { label: t('nav.brand'), href: routes.brand },
      {
        label: t('footer.termsOfService'),
        href: routes.termsOfService
      },
      {
        label: t('footer.enterpriseMsa'),
        href: routes.enterpriseMsa
      },
      {
        label: t('footer.privacyPolicy'),
        href: routes.privacyPolicy
      },
      {
        label: t('footer.trustSafety'),
        href: externalLinks.trustCenter,
        external: true
      }
    ]
  }
]

const socialLinks = getSocialLinks(locale)

const contactColumn: { title: string; links: FooterLink[] } = {
  title: t('footer.contact'),
  links: [
    { label: t('footer.sales'), href: routes.contact },
    {
      label: t('footer.support'),
      href: externalLinks.support,
      external: true
    },
    {
      label: t('footer.cloudStatus'),
      href: externalLinks.cloudStatus,
      external: true
    },
    {
      label: t('footer.press'),
      href: 'mailto:press@comfy.org'
    }
  ]
}
</script>

<template>
  <footer
    ref="footerRef"
    class="bg-primary-comfy-ink px-6 py-8 text-primary-comfy-canvas lg:px-20"
  >
    <div
      class="grid gap-12 border-t border-primary-warm-gray pt-16 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-12"
    >
      <div class="flex flex-col gap-8">
        <p
          class="text-2xl font-medium tracking-wide uppercase lg:max-w-80 lg:text-xl"
        >
          {{ t('footer.tagline') }}
        </p>
        <nav :aria-label="t('footer.social')">
          <ul class="flex flex-wrap gap-2">
            <li v-for="link in socialLinks" :key="link.href">
              <a
                :href="link.href"
                target="_blank"
                rel="noopener noreferrer"
                :aria-label="link.label"
                :title="link.label"
                class="grid size-11 place-items-center rounded-full border border-transparency-white-t20 text-primary-comfy-canvas transition-colors outline-none hover:border-primary-comfy-yellow hover:text-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
              >
                <span
                  :class="cn('size-4.5 icon-mask', link.icon)"
                  aria-hidden="true"
                />
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <!-- Link columns -->
      <div class="flex flex-col gap-12 lg:row-span-2 lg:justify-between">
        <div
          class="grid grid-cols-1 gap-12 lg:grid-cols-3 lg:gap-8 xl:grid-cols-5 xl:gap-6"
        >
          <FooterLinkColumn
            v-for="column in [...topColumns, contactColumn]"
            :key="column.title"
            :title="column.title"
            :links="column.links"
          />
        </div>

        <!-- Bottom bar -->
        <div class="flex justify-center gap-6 lg:justify-end">
          <p class="text-sm">
            {{ t('footer.location') }}
          </p>
          <p class="text-sm">&copy; {{ new Date().getFullYear() }} Comfy Org</p>
        </div>
      </div>

      <!-- Logo -->
      <canvas ref="canvasRef" class="pointer-events-none size-52 lg:mt-28" />
    </div>
  </footer>
</template>
