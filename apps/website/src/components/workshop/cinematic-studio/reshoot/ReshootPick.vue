<script setup lang="ts">
import { Play, Upload } from '@lucide/vue'
import { ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import {
  RESHOOT_EXAMPLE,
  clipFits
} from '../../../../lib/workshop/cinematic-studio/reshoot'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const emit = defineEmits<{ pick: [file?: File] }>()

const over = ref(false)
const tooLong = ref<number>()

function duration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    video.preload = 'metadata'
    video.onloadedmetadata = video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(video.duration)
    }
    video.src = url
  })
}

async function accept(file: File) {
  const seconds = await duration(file)
  tooLong.value =
    Number.isFinite(seconds) && !clipFits(seconds) ? seconds : undefined
  if (tooLong.value === undefined) emit('pick', file)
}

function choose(event: Event) {
  const input = event.target
  if (input instanceof HTMLInputElement && input.files?.[0])
    void accept(input.files[0])
}

function drop(event: DragEvent) {
  over.value = false
  const file = event.dataTransfer?.files[0]
  if (file?.type.startsWith('video/')) void accept(file)
}
</script>

<template>
  <section
    :aria-label="rc('reshoot.title', locale)"
    class="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-8 py-8"
    data-testid="reshoot-pick"
  >
    <header class="flex flex-col items-center gap-2 text-center">
      <h1
        class="text-3xl font-semibold tracking-tight text-primary-warm-white sm:text-4xl"
      >
        {{ rc('reshoot.title', locale) }}
      </h1>
      <p class="max-w-xl text-base text-primary-comfy-canvas">
        {{ rc('reshoot.pick.lead', locale) }}
      </p>
    </header>
    <label
      :class="
        cn(
          'flex w-full cursor-pointer flex-col items-center gap-3 rounded-3xl border-[1.5px] border-dashed border-transparency-white-t20 bg-transparency-white-t4 px-6 py-10 text-center transition-colors focus-within:border-primary-comfy-yellow hover:border-primary-warm-white/40',
          over && 'border-primary-comfy-yellow bg-transparency-white-t8'
        )
      "
      @dragover.prevent="over = true"
      @dragleave="over = false"
      @drop.prevent="drop"
    >
      <Upload class="size-8 text-primary-comfy-yellow" aria-hidden="true" />
      <span class="text-lg font-semibold text-primary-warm-white">
        {{ rc('reshoot.pick.drop', locale) }}
      </span>
      <span class="text-sm text-primary-warm-gray">
        {{ rc('reshoot.clip.help', locale) }}
      </span>
      <span
        class="mt-2 rounded-full bg-primary-comfy-yellow px-5 py-2.5 text-sm font-semibold text-primary-comfy-ink"
      >
        {{ rc('reshoot.pick.upload', locale) }}
      </span>
      <input type="file" accept="video/*" class="sr-only" @change="choose" />
    </label>
    <p
      v-if="tooLong !== undefined"
      role="alert"
      class="-mt-4 text-sm text-destructive-light"
    >
      {{
        rc('reshoot.clip.length', locale).replace(
          '{seconds}',
          tooLong.toFixed(1)
        )
      }}
    </p>
    <div class="flex w-full flex-col gap-3">
      <h2 class="text-sm text-primary-comfy-canvas">
        {{ rc('reshoot.pick.example', locale) }}
      </h2>
      <button
        type="button"
        class="group flex w-fit items-center gap-4 rounded-2xl p-2 pr-5 text-left ring-1 ring-transparency-white-t8 transition-colors ring-inset hover:bg-transparency-white-t4"
        data-testid="reshoot-example"
        @click="emit('pick')"
      >
        <span class="relative block overflow-hidden rounded-xl">
          <video
            :src="RESHOOT_EXAMPLE.clip"
            muted
            playsinline
            preload="metadata"
            class="aspect-video w-48 bg-primary-comfy-ink object-cover"
          />
          <Play
            class="absolute top-1/2 left-1/2 size-7 -translate-1/2 fill-primary-warm-white text-primary-warm-white opacity-80 transition-opacity group-hover:opacity-100"
            aria-hidden="true"
          />
        </span>
        <span class="flex flex-col gap-1">
          <span class="text-sm font-semibold text-primary-warm-white">
            {{ rc('reshoot.clip.example', locale) }}
          </span>
          <span class="text-xs text-primary-warm-gray">
            {{ rc('reshoot.pick.exampleMeta', locale) }}
          </span>
        </span>
      </button>
    </div>
  </section>
</template>
