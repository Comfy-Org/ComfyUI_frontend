<script setup lang="ts">
import { ArrowRight, Check } from '@lucide/vue'

import type { CompareRow } from '../../components/blocks/CompareTable01.vue'
import CompareTable01 from '../../components/blocks/CompareTable01.vue'
import InlineCodeText from '../../components/common/InlineCodeText.vue'
import Button from '../../components/ui/button/Button.vue'
import { externalLinks } from '../../config/routes'
import {
  ROUTER_CATALOG_MODEL_COUNT,
  ROUTER_COMFY_ONLY_PREVIEW,
  ROUTER_PROVIDER_COVERAGE,
  ROUTER_SERVING_PROVIDERS
} from '../../config/router-providers'
import type { Locale } from '../../i18n/translations'
import { routerT } from './routerCopy'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const served = routerT('platform.router.coverage.served', locale)
const notServed = routerT('platform.router.coverage.notServed', locale)

const logos: Record<string, { src: string; class: string }> = {
  Comfy: { src: '/icons/router-providers/comfy.svg', class: 'h-5' },
  fal: { src: '/icons/router-providers/fal.svg', class: 'h-4.5' },
  Higgsfield: { src: '/icons/router-providers/higgsfield.svg', class: 'h-5' },
  Runware: { src: '/icons/router-providers/runware.svg', class: 'h-4' },
  WaveSpeed: { src: '/icons/router-providers/wavespeed.svg', class: 'h-3.5' }
}
const columns = [
  'Comfy',
  ...ROUTER_SERVING_PROVIDERS.map((provider) => provider.name)
]

// The first Comfy-only model stays at full strength; the rest fade out under
// the call to browse the catalog.
const [leadComfyOnly, ...fadingComfyOnly] = ROUTER_COMFY_ONLY_PREVIEW
const fadeClasses = ['opacity-40', 'opacity-10']

const comfyOnlyCells = [
  served,
  ...ROUTER_SERVING_PROVIDERS.map(() => notServed)
]
const rows: CompareRow[] = [
  ...ROUTER_PROVIDER_COVERAGE.map((model) => ({
    id: model.name,
    feature: model.name,
    cells: [
      served,
      ...ROUTER_SERVING_PROVIDERS.map((provider) =>
        model.providers.includes(provider.id) ? served : notServed
      )
    ]
  })),
  {
    id: leadComfyOnly.name,
    feature: leadComfyOnly.name,
    cells: comfyOnlyCells
  },
  ...fadingComfyOnly.map((model, index) => ({
    id: model.name,
    feature: model.name,
    cells: comfyOnlyCells,
    class: fadeClasses[index]
  }))
]

const linkedDocs = new Map(
  [...ROUTER_PROVIDER_COVERAGE, leadComfyOnly].map((model) => [
    model.name,
    model.docsUrl
  ])
)

const moreModels = routerT(
  'platform.router.coverage.moreModels',
  locale
).replace(
  '{count}',
  String(ROUTER_CATALOG_MODEL_COUNT - ROUTER_PROVIDER_COVERAGE.length - 1)
)
const browseAll = routerT('platform.router.coverage.browseAll', locale).replace(
  '{count}',
  String(ROUTER_CATALOG_MODEL_COUNT)
)
</script>

<template>
  <CompareTable01
    :heading="routerT('platform.router.coverage.heading', locale)"
    :feature-label="routerT('platform.router.coverage.modelColumn', locale)"
    :columns="columns"
    :rows="rows"
  >
    <template #subtitle>
      <InlineCodeText
        :text="routerT('platform.router.coverage.body', locale)"
      />
    </template>
    <template #column="{ column }">
      <img
        :src="logos[column].src"
        :alt="column"
        :class="['w-auto max-w-none brightness-0 invert', logos[column].class]"
      />
    </template>
    <template #feature="{ row }">
      <a
        v-if="linkedDocs.has(row.id)"
        :href="linkedDocs.get(row.id)"
        target="_blank"
        rel="noopener noreferrer"
        class="rounded-sm whitespace-nowrap underline underline-offset-4 transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
        >{{ row.feature }}</a
      >
      <span v-else class="whitespace-nowrap">{{ row.feature }}</span>
    </template>
    <template #cell="{ cell }">
      <Check
        v-if="cell === served"
        class="size-5 text-primary-comfy-yellow"
        aria-hidden="true"
      />
      <span v-else aria-hidden="true" class="text-primary-comfy-canvas/30"
        >–</span
      >
      <span class="sr-only">{{ cell }}</span>
    </template>
    <template #footer>
      <div
        class="absolute inset-x-2 bottom-2 flex h-50 flex-col items-center justify-end gap-3 rounded-b-4xl bg-linear-to-b from-transparent to-primary-comfy-ink to-70% px-6 pb-8 text-center"
      >
        <p class="text-lg text-primary-warm-white lg:text-xl">
          <span class="text-primary-comfy-yellow">{{ moreModels }}</span>
          {{ routerT('platform.router.coverage.moreModelsSuffix', locale) }}
        </p>
        <Button
          as="a"
          :href="externalLinks.docsComfyRouterModels"
          target="_blank"
          rel="noopener noreferrer"
          variant="outline"
          class="h-12 rounded-full text-sm"
        >
          {{ browseAll }}
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>
    </template>
  </CompareTable01>
</template>
