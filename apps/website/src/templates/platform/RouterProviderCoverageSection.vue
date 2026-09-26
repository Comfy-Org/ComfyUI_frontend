<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { Check } from '@lucide/vue'

import type { CompareRow } from '../../components/blocks/CompareTable01.vue'
import CompareTable01 from '../../components/blocks/CompareTable01.vue'
import InlineCodeText from '../../components/common/InlineCodeText.vue'
import Button from '../../components/ui/button/Button.vue'
import { getRoutes } from '../../config/routes'
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

type Column = 'Comfy' | (typeof ROUTER_SERVING_PROVIDERS)[number]['name']

const logos: Record<Column, { src: string; class: string }> = {
  Comfy: { src: '/icons/router-providers/comfy.svg', class: 'h-5' },
  fal: { src: '/icons/router-providers/fal.svg', class: 'h-4.5' },
  Higgsfield: { src: '/icons/router-providers/higgsfield.svg', class: 'h-5' },
  Runware: { src: '/icons/router-providers/runware.svg', class: 'h-4' },
  WaveSpeed: { src: '/icons/router-providers/wavespeed.svg', class: 'h-3.5' }
}
const logoByColumn = new Map<string, { src: string; class: string }>(
  Object.entries(logos)
)
const columns: Column[] = [
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
  String(
    ROUTER_CATALOG_MODEL_COUNT -
      ROUTER_PROVIDER_COVERAGE.length -
      ROUTER_COMFY_ONLY_PREVIEW.length
  )
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
      <div class="flex justify-center">
        <img
          :src="logoByColumn.get(column)?.src"
          :alt="column"
          :class="
            cn(
              'w-auto max-w-none brightness-0 invert',
              logoByColumn.get(column)?.class
            )
          "
        />
      </div>
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
      <div class="flex justify-center">
        <Check
          v-if="cell === served"
          class="size-5 text-primary-comfy-yellow"
          aria-hidden="true"
        />
        <span v-else aria-hidden="true" class="text-primary-comfy-canvas/30"
          >–</span
        >
        <span class="sr-only">{{ cell }}</span>
      </div>
    </template>
    <template #footer>
      <div
        class="pointer-events-none absolute inset-x-2 bottom-2 flex h-50 flex-col items-center justify-end gap-3 rounded-b-4xl bg-linear-to-b from-transparent to-primary-comfy-ink to-70% px-6 pb-8 text-center"
      >
        <p class="text-lg text-primary-warm-white lg:text-xl">
          <span class="text-primary-comfy-yellow">{{ moreModels }}</span>
          {{ routerT('platform.router.coverage.moreModelsSuffix', locale) }}
        </p>
        <Button
          as="a"
          :href="getRoutes(locale).modelsShowcase"
          variant="outline"
          class="pointer-events-auto h-12 rounded-full text-sm"
        >
          {{ browseAll }}
        </Button>
      </div>
    </template>
  </CompareTable01>
</template>
