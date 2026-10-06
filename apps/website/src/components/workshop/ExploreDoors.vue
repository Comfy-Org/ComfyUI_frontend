<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { getRoutes } from '@/config/routes'
import type { Locale, TranslationKey } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { DoorArt, HubDoor } from '@/lib/workshop/explore-art'
import ExploreDoorArt from '@/components/workshop/explore-doors/ExploreDoorArt.vue'

const {
  counts,
  art = {},
  locale = 'en'
} = defineProps<{
  counts: Readonly<Record<HubDoor, number>>
  art?: DoorArt
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const routes = getRoutes(locale)

interface Door {
  readonly section: HubDoor
  readonly href: string
  readonly intent: TranslationKey
  readonly title: TranslationKey
  readonly hint: TranslationKey
  readonly surface: string
  readonly pill: string
  readonly artColumn: string
  readonly stage: string
}

const DOORS: readonly Door[] = [
  {
    section: 'models',
    href: routes.workshop,
    intent: 'workshop.explore.modelsIntent',
    title: 'workshop.explore.modelsTitle',
    hint: 'workshop.explore.modelsHint',
    surface: 'bg-illustration-forest text-primary-warm-white',
    pill: 'bg-primary-warm-white/15',
    artColumn: 'sm:w-[calc(42%+4rem)]',
    stage: 'sm:left-16'
  },
  {
    section: 'workflows',
    href: routes.hubWorkflows,
    intent: 'workshop.explore.workflowsIntent',
    title: 'workshop.explore.doorWorkflows',
    hint: 'workshop.explore.workflowsHint',
    surface: 'bg-primary-comfy-plum text-primary-warm-white',
    pill: 'bg-primary-warm-white/15',
    artColumn: 'sm:w-[calc(42%+2rem)]',
    stage: 'sm:left-8'
  },
  {
    section: 'apps',
    href: routes.hubApps,
    intent: 'workshop.explore.appsIntent',
    title: 'workshop.explore.doorApps',
    hint: 'workshop.explore.appsHint',
    surface: 'bg-cobalt-800 text-primary-warm-white',
    pill: 'bg-primary-warm-white/15',
    artColumn: 'sm:w-[calc(42%+3.5rem)]',
    stage: 'sm:left-14'
  }
]

const doors = computed(() =>
  DOORS.filter((door) => door.section === 'models' || counts[door.section])
)
</script>

<template>
  <nav :aria-label="t('workshop.explore.doors')" data-testid="explore-doors">
    <ul class="grid grid-cols-1 gap-5 min-[1360px]:grid-cols-3">
      <li v-for="door in doors" :key="door.section">
        <a
          :href="door.href"
          :class="
            cn(
              'group relative flex h-56 overflow-hidden rounded-3xl outline-none hover:shadow-[0_28px_56px_-24px_rgb(0_0_0/0.8)] hover:inset-ring hover:inset-ring-primary-warm-white/15 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 motion-safe:transition motion-safe:duration-300 motion-safe:hover:-translate-y-1 lg:h-60',
              door.surface
            )
          "
          :data-testid="`explore-door-${door.section}`"
        >
          <span class="flex flex-1 flex-col items-start justify-end p-6 pr-3">
            <span
              :class="
                cn(
                  'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
                  door.pill
                )
              "
              data-testid="explore-door-intent"
            >
              {{ t(door.intent) }}
            </span>
            <span
              class="mt-3 text-4xl leading-none font-semibold tracking-tight lg:max-[1359px]:text-5xl"
            >
              {{ t(door.title) }}
            </span>
            <span
              class="mt-3 text-sm opacity-80"
              data-testid="explore-door-hint"
            >
              {{ t(door.hint) }}
            </span>
          </span>
          <ExploreDoorArt
            v-if="art[door.section]"
            :section="door.section"
            :art
            :art-column="door.artColumn"
            :stage="door.stage"
            :locale
          />
        </a>
      </li>
    </ul>
  </nav>
</template>
