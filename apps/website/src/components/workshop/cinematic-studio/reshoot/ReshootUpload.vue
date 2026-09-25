<script setup lang="ts">
import { Upload } from '@lucide/vue'
import { ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { clipFits } from '../../../../lib/workshop/cinematic-studio/reshoot'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const emit = defineEmits<{ pick: [file: File] }>()

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
  <aside
    :aria-label="rc('reshoot.clip.yours', locale)"
    class="flex flex-col gap-3.5 rounded-2xl bg-primary-comfy-ink-light p-4"
    data-testid="reshoot-pick"
  >
    <h2
      class="text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
    >
      {{ rc('reshoot.clip.yours', locale) }}
    </h2>
    <label
      :class="
        cn(
          'group/drop flex w-full cursor-pointer flex-col items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-transparency-white-t20 bg-transparency-white-t4 px-4 py-8 text-center transition-colors focus-within:border-primary-comfy-yellow hover:border-primary-warm-white/40',
          over && 'border-primary-comfy-yellow bg-transparency-white-t8'
        )
      "
      @dragover.prevent="over = true"
      @dragleave="over = false"
      @drop.prevent="drop"
    >
      <Upload class="size-7 text-primary-comfy-canvas" aria-hidden="true" />
      <span class="text-base font-semibold text-primary-warm-white">
        {{ rc('reshoot.pick.drop', locale) }}
      </span>
      <span class="text-sm text-primary-warm-gray">
        {{ rc('reshoot.clip.help', locale) }}
      </span>
      <span
        class="mt-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-warm-white ring-1 ring-transparency-white-t20 transition-colors ring-inset group-hover/drop:bg-transparency-white-t8"
      >
        {{ rc('reshoot.pick.upload', locale) }}
      </span>
      <input type="file" accept="video/*" class="sr-only" @change="choose" />
    </label>
    <p
      v-if="tooLong !== undefined"
      role="alert"
      class="text-sm text-destructive-light"
    >
      {{
        rc('reshoot.clip.length', locale).replace(
          '{seconds}',
          tooLong.toFixed(1)
        )
      }}
    </p>
  </aside>
</template>
