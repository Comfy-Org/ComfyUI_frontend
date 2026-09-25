<script setup lang="ts">
import { ArrowUpRight, ImagePlus } from '@lucide/vue'
import type { Locale } from '../../../i18n/translations'
import {
  videoStarterCopy,
  videoStarters
} from '../../../lib/workshop/cinematic-studio/video-starters'
import Button from '../../ui/button/Button.vue'

const {
  locale = 'en',
  scene,
  hasFrame = false,
  canAnimate = false,
  disabled = false
} = defineProps<{
  locale?: Locale
  scene: string
  hasFrame?: boolean
  canAnimate?: boolean
  disabled?: boolean
}>()
const emit = defineEmits<{ start: [scene: string]; upload: []; saved: [] }>()
</script>

<template>
  <section
    class="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-6 px-5 py-8 sm:px-8 lg:py-10"
    data-testid="cinematic-video-start"
  >
    <div class="text-center">
      <h1
        class="text-3xl font-semibold tracking-tight text-primary-warm-white lg:text-5xl"
      >
        {{ videoStarterCopy(locale).title }}
      </h1>
      <p
        class="mx-auto mt-3 max-w-xl text-sm text-primary-comfy-canvas sm:text-base"
      >
        {{ videoStarterCopy(locale).body }}
      </p>
    </div>
    <div>
      <p class="mb-3 text-xs text-primary-comfy-canvas">
        {{ videoStarterCopy(locale).hint }}
      </p>
      <ul class="grid gap-3 sm:grid-cols-3 sm:gap-4">
        <li v-for="shot in videoStarters(locale)" :key="shot.id">
          <button
            type="button"
            :disabled
            :aria-pressed="scene === (hasFrame ? shot.motion : shot.scene)"
            class="group flex h-full w-full overflow-hidden rounded-xl border border-transparency-white-t20 bg-primary-comfy-ink-light text-left transition outline-none hover:border-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 disabled:opacity-50 aria-pressed:border-primary-comfy-yellow sm:flex-col"
            data-testid="cinematic-video-starter"
            @click="emit('start', hasFrame ? shot.motion : shot.scene)"
          >
            <img
              :src="shot.image"
              alt=""
              class="aspect-square w-24 shrink-0 object-cover sm:aspect-video sm:w-full"
            />
            <span class="flex flex-1 flex-col gap-1 p-3 sm:p-4">
              <span
                class="flex items-start justify-between gap-2 font-medium text-primary-warm-white"
                >{{ shot.label
                }}<ArrowUpRight
                  class="size-4 shrink-0 text-primary-comfy-yellow"
                  aria-hidden="true"
              /></span>
              <span class="text-xs leading-relaxed text-primary-comfy-canvas">{{
                shot.detail
              }}</span>
            </span>
          </button>
        </li>
      </ul>
    </div>
    <div
      v-if="canAnimate"
      class="flex flex-col gap-4 rounded-xl border border-transparency-white-t20 bg-primary-comfy-ink-light p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="flex items-start gap-3">
        <ImagePlus
          class="mt-1 size-6 shrink-0 text-primary-comfy-yellow"
          aria-hidden="true"
        />
        <div>
          <h2 class="font-medium text-primary-warm-white">
            {{ videoStarterCopy(locale).animate }}
          </h2>
          <p class="mt-1 text-xs text-primary-comfy-canvas">
            {{ videoStarterCopy(locale).animateHint }}
          </p>
        </div>
      </div>
      <div class="flex shrink-0 flex-col gap-2">
        <Button :disabled @click="emit('upload')">{{
          videoStarterCopy(locale).upload
        }}</Button>
        <Button variant="outline" :disabled @click="emit('saved')">{{
          videoStarterCopy(locale).saved
        }}</Button>
      </div>
    </div>
  </section>
</template>
