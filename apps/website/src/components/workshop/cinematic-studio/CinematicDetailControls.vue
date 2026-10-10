<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import { translationsFor } from '@/i18n/translations'
import type { DirectionGroup } from '@/lib/workshop/cinematic-studio/catalog'
import {
  cameraGroups,
  gradeGroup,
  lookGroups
} from '@/lib/workshop/cinematic-studio/catalog'
import type { Locale } from '@/i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const chosen = (group: DirectionGroup) =>
  group.options.filter((option) => option.id !== 'auto')
const PREVIEWS = 3

const framed = lookGroups.map((group) => ({
  group,
  options: chosen(group),
  previews: chosen(group)
    .filter((option) => option.preview)
    .slice(0, PREVIEWS)
}))
const bodies = chosen(cameraGroups[0])
const lenses = chosen(cameraGroups[1])
const grades = chosen(gradeGroup).slice(0, 5)
</script>

<template>
  <section aria-labelledby="cinematic-controls">
    <h2
      id="cinematic-controls"
      class="text-2xl font-semibold text-primary-warm-white lg:text-4xl"
    >
      {{ t('cinematic.detail.controlsTitle') }}
    </h2>
    <p class="mt-3 max-w-2xl text-primary-warm-gray lg:text-lg">
      {{ t('cinematic.detail.controlsLead') }}
    </p>
    <ul class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <li
        v-for="{ group, options, previews } in framed"
        :key="group.part"
        class="overflow-hidden rounded-3xl bg-transparency-white-t4 ring-1 ring-transparency-white-t8"
      >
        <div class="grid aspect-video grid-cols-3 grid-rows-2 gap-0.5">
          <img
            v-for="(option, index) in previews"
            :key="option.id"
            :src="option.preview"
            :alt="t(option.label)"
            :class="
              cn('size-full object-cover', index === 0 && 'col-span-2 row-span-2')
            "
            loading="lazy"
          />
        </div>
        <div class="p-5">
          <div class="flex items-baseline justify-between gap-3">
            <h3 class="text-lg font-semibold text-primary-warm-white">
              {{ t(group.title) }}
            </h3>
            <span class="text-xs text-primary-warm-gray">
              {{ t('cinematic.detail.optionCount', { count: options.length }) }}
            </span>
          </div>
          <p class="mt-1 truncate text-sm text-primary-warm-gray">
            {{ options.map((option) => t(option.label)).join(' · ') }}
          </p>
        </div>
      </li>
      <li
        class="flex flex-col justify-between gap-6 rounded-3xl bg-transparency-white-t4 p-5 ring-1 ring-transparency-white-t8"
      >
        <ul class="flex flex-wrap gap-2">
          <li
            v-for="option in [...bodies, ...lenses]"
            :key="option.id"
            class="rounded-full bg-transparency-white-t8 px-3 py-1 text-sm text-primary-warm-white"
          >
            {{ t(option.label) }}
          </li>
        </ul>
        <h3 class="text-lg font-semibold text-primary-warm-white">
          {{ t('cinematic.detail.cameraTitle') }}
        </h3>
      </li>
      <li
        class="flex flex-col justify-between gap-6 rounded-3xl bg-transparency-white-t4 p-5 ring-1 ring-transparency-white-t8"
      >
        <ul class="flex flex-col gap-2">
          <li
            v-for="option in grades"
            :key="option.id"
            class="flex items-center gap-3"
          >
            <span class="flex h-5 flex-1 overflow-hidden rounded-full">
              <span
                v-for="color in option.palette"
                :key="color"
                class="flex-1"
                :style="{ backgroundColor: color }"
              />
            </span>
            <span class="w-28 truncate text-sm text-primary-warm-gray">
              {{ t(option.label) }}
            </span>
          </li>
        </ul>
        <div class="flex items-baseline justify-between gap-3">
          <h3 class="text-lg font-semibold text-primary-warm-white">
            {{ t(gradeGroup.title) }}
          </h3>
          <span class="text-xs text-primary-warm-gray">
            {{
              t('cinematic.detail.optionCount', {
                count: chosen(gradeGroup).length
              })
            }}
          </span>
        </div>
      </li>
    </ul>
  </section>
</template>
