<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'
import { workshopAppRepo } from '@/lib/workshop/apps'
import type { StarterShot } from '@/lib/workshop/cinematic-studio/starters'
import { STARTER_SHOTS } from '@/lib/workshop/cinematic-studio/starters'
import type { Locale } from '@/i18n/translations'
import CinematicCheckBadge from './CinematicCheckBadge.vue'
import AppRepoLink from './AppRepoLink.vue'

const { selected, locale = 'en' } = defineProps<{
  selected?: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ start: [shot: StarterShot] }>()
</script>

<template>
  <div class="flex max-w-4xl flex-col items-center gap-8 text-center">
    <div class="flex flex-col items-center gap-3">
      <h2
        class="flex items-center gap-3 text-3xl font-semibold tracking-tight text-primary-warm-white lg:text-5xl"
      >
        {{ t('cinematic.title') }}
        <span
          class="rounded-full border border-transparency-white-t20 px-2 py-0.5 font-mono text-[10px] font-normal tracking-wider text-primary-comfy-canvas uppercase lg:text-xs"
        >
          {{ t('cinematic.beta') }}
        </span>
      </h2>
      <p class="max-w-xl text-sm text-primary-comfy-canvas lg:text-base">
        {{ t('cinematic.firstRun.body') }}
      </p>
      <AppRepoLink :repo="workshopAppRepo('studio')" :locale />
    </div>
    <ul class="grid w-full grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
      <li v-for="shot in STARTER_SHOTS" :key="shot.id">
        <button
          type="button"
          :aria-pressed="selected === shot.id"
          class="group flex w-full flex-col gap-2.5 text-left"
          data-testid="cinematic-starter"
          @click="emit('start', shot)"
        >
          <span class="relative">
            <img
              :src="shot.image"
              alt=""
              class="aspect-21/9 w-full rounded-md object-cover opacity-70 ring-primary-warm-white transition group-hover:opacity-100 group-aria-pressed:opacity-100 group-aria-pressed:ring-2"
            />
            <CinematicCheckBadge v-if="selected === shot.id" />
          </span>
          <span
            class="text-sm text-primary-comfy-canvas group-hover:text-primary-warm-white group-aria-pressed:text-primary-warm-white"
          >
            {{ t(shot.label) }}
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>
