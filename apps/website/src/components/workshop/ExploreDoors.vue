<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { getRoutes } from '../../config/routes'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t, tPlural } from '../../i18n/translations'
import type { HubDoor } from '../../lib/workshop/explore-art'

const {
  counts,
  art = {},
  locale = 'en'
} = defineProps<{
  counts: Readonly<Record<HubDoor, number>>
  art?: Partial<Record<HubDoor, readonly string[]>>
  locale?: Locale
}>()

const routes = getRoutes(locale)

interface Door {
  readonly section: HubDoor
  readonly href: string
  readonly title: TranslationKey
  readonly hint: TranslationKey
  readonly count: TranslationKey
  readonly surface: string
  readonly arrow: string
}

const DOORS: readonly Door[] = [
  {
    section: 'apps',
    href: routes.hubApps,
    title: 'workshop.explore.doorApps',
    hint: 'workshop.explore.appsHint',
    count: 'workshop.explore.appsCount',
    surface: 'bg-primary-comfy-yellow text-primary-comfy-ink',
    arrow: 'bg-primary-comfy-ink text-primary-comfy-yellow'
  },
  {
    section: 'workflows',
    href: routes.hubWorkflows,
    title: 'workshop.explore.doorWorkflows',
    hint: 'workshop.explore.workflowsHint',
    count: 'workshop.explore.workflowsCount',
    surface: 'bg-primary-comfy-plum text-primary-warm-white',
    arrow: 'bg-primary-comfy-yellow text-primary-comfy-ink'
  },
  {
    section: 'models',
    href: routes.workshop,
    title: 'workshop.explore.modelsTitle',
    hint: 'workshop.explore.modelsHint',
    count: 'workshop.explore.modelsCount',
    surface: 'bg-illustration-forest text-primary-warm-white',
    arrow: 'bg-primary-comfy-yellow text-primary-comfy-ink'
  }
]

const FAN = [
  'z-30 rotate-6 group-hover:rotate-8',
  'z-20 -rotate-6 group-hover:-rotate-8',
  'z-10 -rotate-18 group-hover:-rotate-24'
]

const doors = computed(() =>
  DOORS.filter((door) => door.section === 'models' || counts[door.section])
)
</script>

<template>
  <nav
    :aria-label="t('workshop.explore.doors', locale)"
    data-testid="explore-doors"
  >
    <ul class="grid grid-cols-1 gap-5 md:auto-cols-fr md:grid-flow-col">
      <li v-for="door in doors" :key="door.section">
        <a
          :href="door.href"
          :class="
            cn(
              'group relative flex h-48 overflow-hidden rounded-3xl outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 lg:h-60',
              door.surface
            )
          "
          :data-testid="`explore-door-${door.section}`"
        >
          <span
            :class="
              cn(
                'absolute top-5 right-5 z-40 grid size-10 place-items-center rounded-full transition-transform duration-200 group-hover:translate-x-0.5',
                door.arrow
              )
            "
            aria-hidden="true"
          >
            <ArrowRight class="size-5" />
          </span>
          <span
            class="absolute right-8 -bottom-8 aspect-3/4 w-20 lg:w-24"
            aria-hidden="true"
          >
            <img
              v-for="(src, index) in art[door.section]"
              :key="src"
              :src
              alt=""
              :class="
                cn(
                  'absolute inset-0 size-full origin-[50%_170%] rounded-xl object-cover shadow-xl ring-2 ring-white/30 transition-transform duration-300 select-none',
                  FAN[index]
                )
              "
              data-testid="explore-door-art"
              loading="lazy"
              decoding="async"
              draggable="false"
            />
          </span>
          <span class="relative z-40 mt-auto flex max-w-1/2 flex-col gap-1 p-6">
            <span
              class="text-xs font-medium tracking-wide uppercase opacity-70"
            >
              {{ tPlural(door.count, counts[door.section], locale) }}
            </span>
            <span class="text-2xl font-medium lg:text-3xl">
              {{ t(door.title, locale) }}
            </span>
            <span class="text-sm opacity-80">
              {{ t(door.hint, locale) }}
            </span>
          </span>
        </a>
      </li>
    </ul>
  </nav>
</template>
