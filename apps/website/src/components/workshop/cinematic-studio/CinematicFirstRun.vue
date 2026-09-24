<script setup lang="ts">
import type { StarterShot } from '../../../lib/workshop/cinematic-studio/starters'
import { STARTER_SHOTS } from '../../../lib/workshop/cinematic-studio/starters'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'

const { selected, locale = 'en' } = defineProps<{
  selected?: string
  locale?: Locale
}>()

const emit = defineEmits<{ start: [shot: StarterShot] }>()
</script>

<template>
  <div class="flex max-w-4xl flex-col items-center gap-8 text-center">
    <div class="flex flex-col items-center gap-3">
      <h1
        class="flex items-center gap-3 text-3xl font-semibold tracking-tight text-primary-warm-white lg:text-5xl"
      >
        {{ tc('cinematic.title', locale) }}
        <span
          class="rounded-full border border-transparency-white-t20 px-2 py-0.5 font-mono text-[10px] font-normal tracking-wider text-primary-comfy-canvas uppercase lg:text-xs"
        >
          {{ tc('cinematic.beta', locale) }}
        </span>
      </h1>
      <p class="max-w-xl text-sm text-primary-comfy-canvas lg:text-base">
        {{ tc('cinematic.firstRun.body', locale) }}
      </p>
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
          <img
            :src="shot.image"
            alt=""
            class="aspect-21/9 w-full rounded-md object-cover opacity-70 ring-primary-warm-white transition group-hover:opacity-100 group-aria-pressed:opacity-100 group-aria-pressed:ring-2"
          />
          <span
            class="text-sm text-primary-comfy-canvas group-hover:text-primary-warm-white group-aria-pressed:text-primary-warm-white"
          >
            {{ tc(shot.label, locale) }}
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>
