<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { ChevronDown } from '@lucide/vue'
import { ref } from 'vue'

import SectionHeader from '../../components/common/SectionHeader.vue'
import Button from '../../components/ui/button/Button.vue'
import { externalLinks } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { RouterRoadmapCardId } from '../../scripts/posthog'
import { captureRouterRoadmapCardExpanded } from '../../scripts/posthog'
import FeatureCard from './FeatureCard.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const cards: readonly {
  id: RouterRoadmapCardId
  title: string
  description: string
  details: string
}[] = [
  {
    id: 'workflow',
    title: t('platform.router.roadmap.1.title', locale),
    description: t('platform.router.roadmap.1.description', locale),
    details: t('platform.router.roadmap.1.details', locale)
  },
  {
    id: 'strategy',
    title: t('platform.router.roadmap.2.title', locale),
    description: t('platform.router.roadmap.2.description', locale),
    details: t('platform.router.roadmap.2.details', locale)
  },
  {
    id: 'use-case',
    title: t('platform.router.roadmap.3.title', locale),
    description: t('platform.router.roadmap.3.description', locale),
    details: t('platform.router.roadmap.3.details', locale)
  }
]

const expandedIds = ref<readonly RouterRoadmapCardId[]>([])

function toggle(id: RouterRoadmapCardId): void {
  if (expandedIds.value.includes(id)) {
    expandedIds.value = expandedIds.value.filter((other) => other !== id)
    return
  }
  expandedIds.value = [...expandedIds.value, id]
  captureRouterRoadmapCardExpanded(id)
}
</script>

<template>
  <section class="mx-auto max-w-9xl px-6 py-10 lg:py-14">
    <SectionHeader
      :label="t('platform.router.roadmap.eyebrow', locale)"
      max-width="xl"
      heading-size="compact"
    >
      {{ t('platform.router.roadmap.heading', locale) }}
      <template #subtitle>
        <p class="mx-auto mt-4 max-w-2xl text-sm text-primary-comfy-canvas/70">
          {{ t('platform.router.roadmap.subtitle', locale) }}
        </p>
      </template>
    </SectionHeader>

    <div class="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
      <FeatureCard
        v-for="card in cards"
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
            <svg
              v-if="card.id === 'workflow'"
              viewBox="0 0 300 160"
              class="size-full"
              fill="none"
            >
              <path d="M55 80h62M183 80h62" stroke="#6858a8" stroke-width="3" />
              <circle cx="42" cy="80" r="20" fill="#4b3e78" />
              <rect
                x="117"
                y="56"
                width="66"
                height="48"
                rx="14"
                fill="#efff45"
              />
              <circle cx="258" cy="80" r="20" fill="#4b3e78" />
            </svg>
            <svg
              v-else-if="card.id === 'strategy'"
              viewBox="0 0 300 160"
              class="size-full"
              fill="none"
            >
              <path
                d="M48 80h58M106 80c45 0 45-45 88-45M106 80h88M106 80c45 0 45 45 88 45"
                stroke="#6858a8"
                stroke-width="3"
                stroke-dasharray="5 8"
              />
              <circle cx="38" cy="80" r="15" fill="#efff45" />
              <rect
                x="194"
                y="20"
                width="68"
                height="30"
                rx="10"
                fill="#4b3e78"
              />
              <rect
                x="194"
                y="65"
                width="68"
                height="30"
                rx="10"
                fill="#efff45"
              />
              <rect
                x="194"
                y="110"
                width="68"
                height="30"
                rx="10"
                fill="#4b3e78"
              />
            </svg>
            <svg v-else viewBox="0 0 300 160" class="size-full" fill="none">
              <rect
                x="28"
                y="28"
                width="74"
                height="104"
                rx="16"
                fill="#4b3e78"
              />
              <rect
                x="113"
                y="28"
                width="74"
                height="104"
                rx="16"
                fill="#322844"
              />
              <rect
                x="198"
                y="28"
                width="74"
                height="104"
                rx="16"
                fill="#4b3e78"
              />
              <path
                d="m48 104 18-23 16 15 20-27v63H28v-12l20-16Z"
                fill="#efff45"
              />
              <circle cx="150" cy="80" r="18" fill="#efff45" />
              <path d="m143 68 20 12-20 12V68Z" fill="#1d1723" />
              <path
                d="M215 105c0-20 14-36 31-36s26 16 26 36"
                stroke="#efff45"
                stroke-width="8"
              />
            </svg>
          </div>
        </template>
        <p
          v-if="expandedIds.includes(card.id)"
          class="mt-3 text-xs/relaxed font-light text-primary-comfy-canvas"
        >
          {{ card.details }}
        </p>
        <button
          type="button"
          :aria-expanded="expandedIds.includes(card.id)"
          class="mt-4 inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary-comfy-yellow after:absolute after:inset-0 after:rounded-3xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-primary-comfy-yellow/50"
          @click="toggle(card.id)"
        >
          {{
            t(
              expandedIds.includes(card.id)
                ? 'platform.router.roadmap.readLess'
                : 'platform.router.roadmap.readMore',
              locale
            )
          }}
          <ChevronDown
            aria-hidden="true"
            :class="
              cn(
                'size-4 transition-transform',
                expandedIds.includes(card.id) && 'rotate-180'
              )
            "
          />
        </button>
      </FeatureCard>
    </div>

    <div class="mt-8 flex justify-center">
      <Button as="a" :href="externalLinks.docsComfyRouter" variant="outline">
        {{ t('platform.router.roadmap.learnMore', locale) }}
      </Button>
    </div>
  </section>
</template>
