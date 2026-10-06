<script setup lang="ts">
import { ArrowRight, Play, Sparkles } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { getRoutes } from '@/config/routes'
import type { Locale, TranslationKey } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { DoorArt, HubDoor } from '@/lib/workshop/explore-art'
import { initialsOf } from '@/lib/workshop/initials'

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
  readonly arrow: string
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
    arrow: 'bg-primary-comfy-yellow text-primary-comfy-ink',
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
    arrow: 'bg-primary-comfy-yellow text-primary-comfy-ink',
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
    surface: 'bg-primary-comfy-yellow text-primary-comfy-ink',
    arrow: 'bg-primary-comfy-ink text-primary-comfy-yellow',
    pill: 'bg-primary-comfy-ink/10',
    artColumn: 'sm:w-[calc(42%+3.5rem)]',
    stage: 'sm:left-14'
  }
]

const doors = computed(() =>
  DOORS.filter((door) => door.section === 'models' || counts[door.section])
)

const modelPrice = computed(() => {
  const model = art.models
  if (model?.usd !== undefined) return `$${model.usd.toFixed(2)}`
  if (model?.credits !== undefined)
    return t('workshop.explore.doorModelCredits', { credits: model.credits })
  return undefined
})

const MICRO =
  'text-3xs font-semibold tracking-widest text-primary-warm-white/45 uppercase'
const FLOAT =
  'absolute top-1/2 right-2 z-10 origin-right -translate-y-1/2 rounded-[14px] bg-primary-comfy-ink/90 text-primary-warm-white shadow-2xl shadow-black/60 ring-1 ring-primary-warm-white/10 backdrop-blur-xl inset-shadow-2xs inset-shadow-primary-warm-white/10 max-sm:w-[calc((100%-0.5rem)*4/3)] max-sm:scale-75 sm:max-w-full motion-safe:animate-[platform-builder-float_5s_ease-in-out_infinite] sm:right-auto sm:left-0 sm:origin-left'
const PORT =
  'absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-primary-comfy-yellow ring-3 ring-primary-comfy-ink'
const WIDGET =
  'flex items-center justify-between gap-2 rounded-md bg-primary-warm-white/5 px-2 py-1 text-3xs'
const workflowWidgets = computed(() => [
  {
    label: t('workshop.explore.doorWorkflowImage'),
    value: t('workshop.explore.doorWorkflowFile')
  },
  { label: t('workshop.explore.doorWorkflowLight'), value: '45°' },
  { label: t('workshop.explore.doorWorkflowStrength'), value: '0.80' }
])
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
          <span
            :class="
              cn(
                'absolute top-4 right-4 z-20 grid size-8 place-items-center rounded-full group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 motion-safe:transition motion-safe:duration-300 can-hover:-translate-x-1 can-hover:opacity-0',
                door.arrow
              )
            "
            aria-hidden="true"
          >
            <ArrowRight class="size-4" />
          </span>
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
          <span
            v-if="art[door.section]"
            :class="cn('relative w-2/5', door.artColumn)"
            aria-hidden="true"
            data-testid="explore-door-art"
          >
            <span
              :class="cn('absolute top-6 right-0 bottom-0 left-0', door.stage)"
            >
              <span
                class="absolute inset-0 overflow-hidden rounded-tl-2xl ring-1 ring-primary-warm-white/20"
              >
                <img
                  :src="art[door.section]?.src"
                  alt=""
                  class="size-full object-cover select-none group-hover:scale-105 motion-safe:transition-transform motion-safe:duration-700"
                  loading="lazy"
                  decoding="async"
                  draggable="false"
                />
                <span
                  class="absolute inset-0 group-hover:bg-black/20 motion-safe:transition-colors motion-safe:duration-500"
                />
              </span>

              <span
                v-if="door.section === 'models' && art.models"
                :class="cn(FLOAT, 'sm:w-52 sm:translate-x-[-30%]')"
              >
                <span
                  class="flex items-center gap-1.5 px-3 pt-2.5 text-2xs text-primary-warm-white/70"
                >
                  <Sparkles class="size-3 shrink-0 text-primary-comfy-yellow" />
                  <span class="truncate">{{ t(art.models.prompt) }}</span>
                  <span
                    class="-ml-0.5 inline-block h-3 w-px shrink-0 bg-primary-comfy-yellow motion-safe:animate-cursor-blink"
                  />
                </span>
                <span
                  class="mt-2.5 flex items-center gap-2.5 border-t border-primary-warm-white/10 px-3 pt-2.5"
                >
                  <span
                    v-if="art.models.provider"
                    class="grid size-7 shrink-0 place-items-center rounded-lg bg-illustration-forest text-3xs font-bold ring-1 ring-primary-warm-white/15"
                  >
                    {{ initialsOf(art.models.provider) }}
                  </span>
                  <span class="min-w-0">
                    <span class="block truncate text-xs font-semibold">
                      {{ art.models.name }}
                    </span>
                    <span
                      class="block truncate text-3xs text-primary-warm-white/50"
                    >
                      {{
                        art.models.provider
                          ? t('workshop.explore.doorModelMeta', {
                              provider: art.models.provider
                            })
                          : t('workshop.explore.doorModelImage')
                      }}
                    </span>
                  </span>
                </span>
                <span
                  class="flex items-center justify-between gap-2 px-3 py-2.5"
                >
                  <span
                    class="flex gap-1 rounded-lg bg-primary-warm-white/5 p-0.5 text-3xs font-medium"
                  >
                    <span
                      class="rounded-md bg-primary-warm-white/15 px-2 py-0.5 group-hover:bg-transparent group-hover:text-primary-warm-white/60 motion-safe:transition-colors motion-safe:duration-300"
                    >
                      {{ t('workshop.explore.doorModelRun') }}
                    </span>
                    <span
                      class="rounded-md px-2 py-0.5 text-primary-warm-white/60 group-hover:bg-primary-warm-white/15 group-hover:text-primary-warm-white motion-safe:transition-colors motion-safe:duration-300"
                    >
                      {{ t('workshop.explore.doorModelApi') }}
                    </span>
                  </span>
                  <span
                    v-if="modelPrice"
                    class="font-mono text-2xs whitespace-nowrap text-primary-comfy-yellow"
                  >
                    {{ modelPrice }}
                    <span class="text-primary-warm-white/40">
                      {{ t('workshop.explore.doorModelPerImage') }}
                    </span>
                  </span>
                </span>
              </span>

              <span
                v-else-if="door.section === 'workflows'"
                :class="
                  cn(
                    FLOAT,
                    'sm:w-40 sm:max-w-[calc(100%-1rem)] sm:translate-x-[-18%]'
                  )
                "
              >
                <span
                  class="flex items-center gap-1.5 border-b border-primary-warm-white/10 px-2.5 py-1.5 text-2xs font-semibold"
                >
                  <span class="size-1.5 rounded-full bg-primary-comfy-yellow" />
                  {{ t('workshop.explore.doorWorkflowStep') }}
                </span>
                <span class="relative flex flex-col gap-1 p-2">
                  <span
                    v-for="widget in workflowWidgets"
                    :key="widget.label"
                    :class="WIDGET"
                  >
                    <span class="text-primary-warm-white/55">
                      {{ widget.label }}
                    </span>
                    <span class="truncate font-mono">{{ widget.value }}</span>
                  </span>
                  <span
                    class="pointer-events-none absolute top-1/2 left-full h-[calc(50%+1rem)] w-5 rounded-tr-xl border-t-2 border-r-2 border-primary-comfy-yellow [clip-path:inset(0_100%_100%_0)] motion-safe:transition-[clip-path] motion-safe:duration-500 motion-safe:ease-out motion-safe:group-hover:delay-300 motion-safe:group-hover:[clip-path:inset(0)] max-sm:hidden"
                    data-testid="explore-door-wire"
                  />
                  <span
                    class="pointer-events-none absolute top-[calc(100%+1rem)] -right-7 flex translate-y-1 items-center gap-1.5 rounded-lg bg-primary-comfy-ink px-2 py-1 text-3xs font-semibold whitespace-nowrap opacity-0 shadow-xl ring-1 ring-primary-warm-white/10 motion-safe:transition motion-safe:duration-300 motion-safe:group-hover:translate-y-0 motion-safe:group-hover:opacity-100 motion-safe:group-hover:delay-700 max-sm:hidden"
                  >
                    <span
                      class="size-1.5 rounded-full bg-primary-comfy-yellow"
                    />
                    {{ t('workshop.explore.doorWorkflowSave') }}
                  </span>
                  <span
                    :class="
                      cn(
                        PORT,
                        '-left-1.5 group-hover:scale-150 motion-safe:transition-transform motion-safe:duration-300'
                      )
                    "
                  />
                  <span
                    :class="
                      cn(
                        PORT,
                        '-right-1.5 group-hover:scale-150 motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:delay-300'
                      )
                    "
                  />
                </span>
              </span>

              <span
                v-else-if="door.section === 'apps' && art.apps"
                :class="cn(FLOAT, 'sm:w-48 sm:translate-x-[-26%]')"
              >
                <span class="block px-3 pt-3">
                  <span class="flex items-center justify-between gap-2">
                    <span :class="cn(MICRO, 'truncate')">
                      {{ t(art.apps.control) }}
                    </span>
                    <span class="font-mono text-2xs">{{ art.apps.value }}</span>
                  </span>
                  <span
                    class="relative mt-2.5 block h-1 rounded-full bg-primary-warm-white/15"
                  >
                    <span
                      class="absolute inset-y-0 left-0 w-[30%] rounded-full bg-primary-comfy-yellow group-hover:w-[78%] motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out"
                    />
                    <span
                      class="absolute top-1/2 left-[30%] size-3.5 -translate-1/2 rounded-full bg-primary-warm-white shadow-sm ring-2 ring-primary-comfy-yellow group-hover:left-[78%] motion-safe:transition-[left] motion-safe:duration-700 motion-safe:ease-out"
                    />
                  </span>
                  <span class="mt-2 flex justify-between px-px">
                    <span
                      v-for="tick in 9"
                      :key="tick"
                      class="h-1 w-px bg-primary-warm-white/25"
                    />
                  </span>
                </span>
                <span class="block p-2 pt-3">
                  <span
                    class="flex items-center justify-center gap-2 rounded-[10px] bg-primary-comfy-yellow py-2 text-xs font-semibold text-primary-comfy-ink group-hover:scale-97 group-hover:ring-4 group-hover:ring-primary-comfy-yellow/30 motion-safe:transition motion-safe:duration-300 motion-safe:group-hover:delay-500"
                  >
                    <Play class="size-3.5" />
                    {{ t('workshop.explore.doorAppGenerate') }}
                  </span>
                </span>
              </span>
            </span>
          </span>
        </a>
      </li>
    </ul>
  </nav>
</template>
