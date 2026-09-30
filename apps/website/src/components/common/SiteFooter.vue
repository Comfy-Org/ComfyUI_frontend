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
    title: t('footer.products', {}, { locale: locale }),
    links: [
      {
        label: t('nav.comfyLocal', {}, { locale: locale }),
        href: routes.download
      },
      {
        label: t('nav.comfyCloud', {}, { locale: locale }),
        href: routes.cloud
      },
      {
        label: t('nav.developerPlatform', {}, { locale: locale }),
        href: routes.platform
      },
      {
        label: t('nav.comfyEnterprise', {}, { locale: locale }),
        href: routes.enterprise
      },
      { label: t('nav.pricing', {}, { locale: locale }), href: routes.pricing },
      { label: t('nav.mcpServer', {}, { locale: locale }), href: routes.mcp },
      {
        label: t('nav.comfyAgent', {}, { locale: locale }),
        href: routes.agent
      },
      { label: t('nav.comfyCli', {}, { locale: locale }), href: routes.cli }
    ]
  },
  {
    title: t('footer.models', {}, { locale: locale }),
    links: [
      {
        label: t('footer.modelCatalogue', {}, { locale: locale }),
        href: routes.workshop
      },
      {
        label: t('nav.supportedModels', {}, { locale: locale }),
        href: routes.models
      },
      {
        label: t('footer.minimaxH3', {}, { locale: locale }),
        href: routes.minimax
      },
      {
        label: t('footer.minimaxMusic3', {}, { locale: locale }),
        href: routes.minimaxMusic3
      },
      {
        label: t('footer.minimaxLicense', {}, { locale: locale }),
        href: routes.minimaxLicense
      },
      {
        label: t('footer.seedance', {}, { locale: locale }),
        href: routes.seedance
      },
      {
        label: t('footer.wanAnimate2', {}, { locale: locale }),
        href: routes.wanAnimate2
      },
      { label: t('footer.ltx', {}, { locale: locale }), href: routes.ltx },
      {
        label: t('footer.geminiOmni', {}, { locale: locale }),
        href: routes.geminiOmni
      },
      { label: t('footer.wan3', {}, { locale: locale }), href: routes.wan3 },
      {
        label: t('footer.chatgptImage25', {}, { locale: locale }),
        href: routes.chatgptImage25
      },
      {
        label: t('footer.qwenImage21', {}, { locale: locale }),
        href: routes.qwenImage21
      },
      { label: t('footer.flux3', {}, { locale: locale }), href: routes.flux3 }
    ]
  },
  {
    title: t('footer.resources', {}, { locale: locale }),
    links: [
      {
        label: t('nav.learning', {}, { locale: locale }),
        href: routes.learning
      },
      {
        label: t('nav.customerStories', {}, { locale: locale }),
        href: routes.customers
      },
      {
        label: t('footer.workflows', {}, { locale: locale }),
        href: externalLinks.workflows
      },
      {
        label: t('footer.useCases', {}, { locale: locale }),
        href: externalLinks.workflowUseCases
      },
      {
        label: t('nav.launches', {}, { locale: locale }),
        href: routes.launches
      },
      { label: t('nav.fdct', {}, { locale: locale }), href: routes.fdct },
      {
        label: t('footer.blog', {}, { locale: locale }),
        href: externalLinks.blog,
        external: true
      },
      {
        label: t('nav.discord', {}, { locale: locale }),
        href: externalLinks.discord,
        external: true
      },
      {
        label: t('nav.github', {}, { locale: locale }),
        href: externalLinks.github,
        external: true
      },
      {
        label: t('nav.docs', {}, { locale: locale }),
        href: externalLinks.docs,
        external: true
      },
      {
        label: t('nav.youtube', {}, { locale: locale }),
        href: externalLinks.youtube,
        external: true
      },
      {
        label: t('nav.instagram', {}, { locale: locale }),
        href: externalLinks.instagram,
        external: true
      },
      {
        label: t('nav.x', {}, { locale: locale }),
        href: externalLinks.x,
        external: true
      },
      {
        label: t('nav.linkedin', {}, { locale: locale }),
        href: externalLinks.linkedin,
        external: true
      },
      {
        label: t('footer.affiliateProgram', {}, { locale: locale }),
        href: routes.affiliates
      }
    ]
  },
  {
    title: t('footer.company', {}, { locale: locale }),
    links: [
      { label: t('footer.about', {}, { locale: locale }), href: routes.about },
      { label: t('nav.careers', {}, { locale: locale }), href: routes.careers },
      { label: t('nav.brand', {}, { locale: locale }), href: routes.brand },
      {
        label: t('footer.termsOfService', {}, { locale: locale }),
        href: routes.termsOfService
      },
      {
        label: t('footer.enterpriseMsa', {}, { locale: locale }),
        href: routes.enterpriseMsa
      },
      {
        label: t('footer.privacyPolicy', {}, { locale: locale }),
        href: routes.privacyPolicy
      },
      {
        label: t('footer.trustSafety', {}, { locale: locale }),
        href: externalLinks.trustCenter,
        external: true
      }
    ]
  }
]

const contactColumn: { title: string; links: FooterLink[] } = {
  title: t('footer.contact', {}, { locale: locale }),
  links: [
    { label: t('footer.sales', {}, { locale: locale }), href: routes.contact },
    {
      label: t('footer.support', {}, { locale: locale }),
      href: externalLinks.support,
      external: true
    },
    {
      label: t('footer.cloudStatus', {}, { locale: locale }),
      href: externalLinks.cloudStatus,
      external: true
    },
    {
      label: t('footer.press', {}, { locale: locale }),
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
      class="grid gap-12 border-t border-primary-warm-gray pt-16 lg:grid-cols-2 lg:gap-4"
    >
      <!-- Tagline -->
      <p class="text-2xl font-medium tracking-wide uppercase lg:text-3xl">
        {{ t('footer.tagline', {}, { locale: locale }) }}
      </p>

      <!-- Link columns -->
      <div class="flex flex-col gap-12 lg:row-span-2 lg:justify-between">
        <div class="flex flex-col gap-12">
          <div class="grid grid-cols-1 gap-12 lg:grid-cols-4">
            <FooterLinkColumn
              v-for="column in topColumns"
              :key="column.title"
              :title="column.title"
              :links="column.links"
            />
          </div>

          <div class="grid grid-cols-1 gap-12">
            <FooterLinkColumn
              :title="contactColumn.title"
              :links="contactColumn.links"
            />
          </div>
        </div>

        <!-- Bottom bar -->
        <div class="flex justify-center gap-6 lg:justify-end">
          <p class="text-sm">
            {{ t('footer.location', {}, { locale: locale }) }}
          </p>
          <p class="text-sm">&copy; {{ new Date().getFullYear() }} Comfy Org</p>
        </div>
      </div>

      <!-- Logo -->
      <canvas ref="canvasRef" class="pointer-events-none size-52 lg:mt-28" />
    </div>
  </footer>
</template>
