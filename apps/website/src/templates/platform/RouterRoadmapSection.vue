<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { Minus, Plus } from '@lucide/vue'
import { useMediaQuery, useResizeObserver } from '@vueuse/core'
import type { CSSProperties } from 'vue'
import { ref, useTemplateRef, watch } from 'vue'

import SectionHeader from '../../components/common/SectionHeader.vue'
import Button from '../../components/ui/button/Button.vue'
import { externalLinks } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { routerT } from './routerCopy'
import type { RouterRoadmapCardId } from '../../scripts/posthog'
import { captureRouterRoadmapCardExpanded } from '../../scripts/posthog'
import FeatureCard from './FeatureCard.vue'
import RouterRoadmapIllustration from './RouterRoadmapIllustration.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const cards: readonly {
  id: RouterRoadmapCardId
  title: string
  description: string
  details: string
}[] = [
  {
    id: 'workflow',
    title: routerT('platform.router.roadmap.1.title', locale),
    description: routerT('platform.router.roadmap.1.description', locale),
    details: routerT('platform.router.roadmap.1.details', locale)
  },
  {
    id: 'strategy',
    title: routerT('platform.router.roadmap.2.title', locale),
    description: routerT('platform.router.roadmap.2.description', locale),
    details: routerT('platform.router.roadmap.2.details', locale)
  },
  {
    id: 'use-case',
    title: routerT('platform.router.roadmap.3.title', locale),
    description: routerT('platform.router.roadmap.3.description', locale),
    details: routerT('platform.router.roadmap.3.details', locale)
  },
  {
    id: 'byok',
    title: routerT('platform.router.roadmap.4.title', locale),
    description: routerT('platform.router.roadmap.4.description', locale),
    details: routerT('platform.router.roadmap.4.details', locale)
  }
]

const expandedIds = ref<readonly RouterRoadmapCardId[]>([])

function isExpanded(id: RouterRoadmapCardId): boolean {
  return expandedIds.value.includes(id)
}

function toggle(id: RouterRoadmapCardId): void {
  if (isExpanded(id)) {
    expandedIds.value = expandedIds.value.filter((other) => other !== id)
    return
  }
  expandedIds.value = [...expandedIds.value, id]
  captureRouterRoadmapCardExpanded(id)
}

// From md up the three cards share a row, and a card must only ever match its
// neighbours in the same state: collapsed cards line up with each other and
// expanded cards with each other, while a card that is left alone keeps its
// height. A shared grid track would stretch the untouched cards, so each panel
// is padded instead — to the tallest collapsed card below its copy, and to the
// tallest details copy when open.
const grid = useTemplateRef<HTMLElement>('grid')
const sharesRow = useMediaQuery('(width >= 48rem)')
const fills = ref<readonly number[]>([])
const detailsHeight = ref(0)

function measure(): void {
  const el = grid.value
  if (!el || !sharesRow.value) {
    fills.value = []
    detailsHeight.value = 0
    return
  }
  const panels = [...el.querySelectorAll<HTMLElement>('[data-details]')]
  const collapsed = panels.map(
    (panel) => (panel.parentElement?.offsetHeight ?? 0) - panel.offsetHeight
  )
  const tallest = Math.max(0, ...collapsed)
  fills.value = collapsed.map((height) => tallest - height)
  detailsHeight.value = Math.max(
    0,
    ...[...el.querySelectorAll<HTMLElement>('[data-details-text]')].map(
      (text) => text.offsetHeight
    )
  )
}

useResizeObserver(grid, measure)
watch(sharesRow, measure)

function panelStyle(index: number, expanded: boolean): CSSProperties {
  const fill = fills.value[index] ?? 0
  return {
    minHeight: `${fill + (expanded ? detailsHeight.value : 0)}px`,
    visibility: expanded ? 'visible' : 'hidden'
  }
}
</script>

<template>
  <section class="mx-auto max-w-9xl px-6 py-10 lg:py-14">
    <SectionHeader
      :label="routerT('platform.router.roadmap.eyebrow', locale)"
      max-width="xl"
      heading-size="compact"
    >
      {{ routerT('platform.router.roadmap.heading', locale) }}
      <template #subtitle>
        <p
          class="mx-auto mt-4 max-w-2xl text-sm text-pretty text-primary-comfy-canvas/70"
        >
          {{ routerT('platform.router.roadmap.subtitle', locale) }}
        </p>
      </template>
    </SectionHeader>

    <div
      ref="grid"
      class="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 md:items-start xl:grid-cols-4"
    >
      <FeatureCard
        v-for="(card, index) in cards"
        :key="card.id"
        :title="card.title"
        :description="card.description"
        class="relative bg-transparency-white-t4 transition-colors has-[button:hover]:bg-transparency-white-t8"
      >
        <template #visual>
          <div
            aria-hidden="true"
            class="flex aspect-video items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-primary-comfy-ink p-5"
          >
            <RouterRoadmapIllustration :card="card.id" />
          </div>
        </template>
        <div
          :id="`router-roadmap-${card.id}-details`"
          data-details
          :style="panelStyle(index, isExpanded(card.id))"
          :class="
            cn(
              'grid transition-all duration-300 ease-out motion-reduce:transition-none',
              isExpanded(card.id) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
            )
          "
        >
          <p
            class="min-h-0 overflow-hidden text-xs/relaxed font-light text-pretty text-primary-comfy-canvas"
          >
            <span data-details-text class="block pt-3">{{ card.details }}</span>
          </p>
        </div>
        <button
          type="button"
          :aria-expanded="isExpanded(card.id)"
          :aria-controls="`router-roadmap-${card.id}-details`"
          :class="
            cn(
              'mt-4 inline-flex cursor-pointer items-center gap-1 text-xs font-medium transition-colors after:absolute after:inset-0 after:rounded-3xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-primary-comfy-yellow/50',
              isExpanded(card.id)
                ? 'text-primary-comfy-yellow'
                : 'text-primary-comfy-canvas/70 hover:text-primary-warm-white'
            )
          "
          @click="toggle(card.id)"
        >
          {{ t(isExpanded(card.id) ? 'ui.readLess' : 'ui.readMore', locale) }}
          <span class="sr-only">{{ card.title }}</span>
          <component
            :is="isExpanded(card.id) ? Minus : Plus"
            aria-hidden="true"
            class="size-4"
          />
        </button>
      </FeatureCard>
    </div>

    <div class="mt-8 flex justify-center">
      <Button as="a" :href="externalLinks.docsComfyRouter" variant="outline">
        {{ routerT('platform.router.roadmap.learnMore', locale) }}
      </Button>
    </div>
  </section>
</template>
