<script setup lang="ts">
import { externalLinks, getRoutes } from '@/config/routes'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { LocaleAlternate } from '@/lib/hreflang'
import FooterLinkColumn from './FooterLinkColumn.vue'
import type { FooterLink } from './FooterLinkColumn.vue'
import FooterSocialLinks from './FooterSocialLinks.vue'
import LanguageSwitcher from './LanguageSwitcher.vue'

const { locale = 'en', alternates = [] } = defineProps<{
  locale?: Locale
  alternates?: readonly LocaleAlternate[]
}>()
const { t } = translationsFor(locale)
const routes = getRoutes(locale)

type FooterColumn = { title: string; links: FooterLink[] }

const products: FooterColumn = {
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
      label: t('nav.comfyRouter'),
      href: routes.platformRouter
    },
    {
      label: t('nav.comfyEnterprise'),
      href: routes.enterprise
    },
    {
      label: t('nav.managedBuilds'),
      href: routes.managedBuilds
    },
    { label: t('nav.pricing'), href: routes.pricing }
  ]
}

const features: FooterColumn = {
  title: t('nav.colFeatures'),
  links: [
    { label: t('nav.mcpServer'), href: routes.mcp },
    {
      label: t('nav.comfyAgent'),
      href: routes.agent
    },
    { label: t('nav.comfyCli'), href: routes.cli },
    {
      label: t('nav.launches'),
      href: routes.launches
    },
    {
      label: t('nav.supportedModels'),
      href: routes.models
    }
  ]
}

const models: FooterColumn = {
  title: t('footer.models'),
  links: [
    {
      label: t('footer.modelCatalogue'),
      href: routes.workshop
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
    { label: t('footer.nanoBanana'), href: routes.nanoBanana },
    { label: t('footer.flux3'), href: routes.flux3 }
  ]
}

const resources: FooterColumn = {
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
    },
    { label: t('footer.changelog'), href: routes.changelog }
  ]
}

const company: FooterColumn = {
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

const contact: FooterColumn = {
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

const columnGroups: FooterColumn[][] = [
  [products, features],
  [models],
  [resources],
  [company, contact]
]
</script>

<template>
  <footer
    class="bg-primary-comfy-ink px-6 py-8 text-primary-comfy-canvas lg:px-20"
  >
    <div class="flex flex-col gap-16 border-t border-primary-warm-gray pt-16">
      <div class="flex flex-col gap-10">
        <FooterSocialLinks :locale />
        <div class="grid grid-cols-1 gap-12 lg:grid-cols-4 lg:gap-x-6">
          <div
            v-for="group in columnGroups"
            :key="group[0].title"
            class="flex flex-col gap-12"
          >
            <FooterLinkColumn
              v-for="column in group"
              :key="column.title"
              :title="column.title"
              :links="column.links"
            />
          </div>
        </div>
      </div>
      <div
        class="flex flex-col gap-12 lg:flex-row lg:items-end lg:justify-between"
      >
        <p class="text-2xl font-medium tracking-wide uppercase lg:text-3xl">
          {{ t('footer.tagline') }}
        </p>

        <div class="flex flex-col items-center gap-4 lg:shrink-0 lg:items-end">
          <LanguageSwitcher :locale :alternates />
          <div class="flex flex-wrap justify-center gap-6 text-sm">
            <p>{{ t('footer.location') }}</p>
            <p>&copy; {{ new Date().getFullYear() }} Comfy Org</p>
          </div>
        </div>
      </div>
    </div>
  </footer>
</template>
