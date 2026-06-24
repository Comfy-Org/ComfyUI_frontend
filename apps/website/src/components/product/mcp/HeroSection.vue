<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import { externalLinks, getRoutes } from '../../../config/routes'
import { t } from '../../../i18n/translations'
import BrandButton from '../../common/BrandButton.vue'
import ProductHeroBadge from '../../common/ProductHeroBadge.vue'
import ComfyMcpDemo from './ComfyMcpDemo.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = getRoutes(locale)
</script>

<template>
  <section
    class="max-w-9xl relative mx-auto flex flex-col items-center overflow-hidden lg:flex-row lg:items-center lg:overflow-x-visible lg:pb-[min(8vw,10rem)]"
  >
    <!-- Text -->
    <div class="relative z-10 w-full px-4 py-12 lg:min-w-140 lg:flex-1 lg:p-20">
      <ProductHeroBadge text="MCP" />

      <h1
        class="mt-6 text-3xl/tight font-light whitespace-pre-line text-primary-comfy-canvas md:text-4xl/tight lg:max-w-xl lg:text-5xl/tight"
      >
        {{ t('mcp.hero.heading', locale) }}
      </h1>

      <p
        class="mt-6 max-w-md text-sm text-primary-comfy-canvas lg:mt-6 lg:text-base"
      >
        {{ t('mcp.hero.subtitle', locale) }}
      </p>

      <div class="mt-8 flex flex-col gap-4 lg:flex-row">
        <BrandButton
          :href="externalLinks.docsMcp"
          variant="outline"
          size="lg"
          class="text-center lg:min-w-48 lg:p-4"
        >
          {{ t('mcp.hero.viewDocs', locale) }}
        </BrandButton>
        <BrandButton
          :href="routes.cloud"
          size="lg"
          class="text-center lg:min-w-48 lg:p-4"
        >
          {{ t('mcp.hero.runWorkflow', locale) }}
        </BrandButton>
      </div>
    </div>

    <!-- Illustration -->
    <div
      class="w-full self-center px-4 py-8 lg:pointer-events-none lg:z-1 lg:flex-1 lg:self-center lg:px-10 lg:py-0"
    >
      <ComfyMcpDemo />
    </div>
  </section>
</template>
