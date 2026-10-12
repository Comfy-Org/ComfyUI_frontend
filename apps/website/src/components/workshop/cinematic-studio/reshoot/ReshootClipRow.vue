<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'
import { ref, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { clipFits } from '@/lib/workshop/cinematic-studio/reshoot'
import { fileSecondsOf } from '@/lib/workshop/cinematic-studio/reshoot-clip'
import type { Locale } from '@/i18n/translations'

const {
  clip,
  name,
  status,
  locale = 'en'
} = defineProps<{
  clip: string
  name: string
  status: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ pick: [file: File] }>()

const input = useTemplateRef<HTMLInputElement>('input')
const over = ref(false)
const rejected = ref<string>()

async function accept(file: File) {
  const seconds = await fileSecondsOf(file)
  rejected.value =
    Number.isFinite(seconds) && !clipFits(seconds)
      ? t('reshoot.clip.rejected', {
          name: file.name,
          seconds: seconds.toFixed(1)
        })
      : undefined
  if (rejected.value === undefined) emit('pick', file)
}

function choose(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  const file = target.files?.[0]
  target.value = ''
  if (file) void accept(file)
}

function drop(event: DragEvent) {
  over.value = false
  const file = event.dataTransfer?.files[0]
  if (file?.type.startsWith('video/')) void accept(file)
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div
      :aria-label="t('reshoot.section.video')"
      role="group"
      :class="
        cn(
          'flex min-h-12 items-center gap-3 rounded-2xl border border-transparency-white-t8 py-2 pr-2 pl-3 transition-colors',
          over && 'border-primary-comfy-yellow bg-transparency-white-t8'
        )
      "
      data-testid="reshoot-clip"
      @dragover.prevent="over = true"
      @dragleave="over = false"
      @drop.prevent="drop"
    >
      <video
        :src="clip"
        muted
        playsinline
        preload="metadata"
        class="h-7 w-10 shrink-0 rounded-sm bg-primary-comfy-ink object-cover"
      />
      <span class="flex min-w-0 flex-1 flex-col">
        <span class="truncate text-sm font-semibold text-primary-warm-white">{{
          name
        }}</span>
        <span class="truncate text-xs text-primary-warm-gray">{{
          status
        }}</span>
      </span>
      <button
        type="button"
        :title="t('reshoot.clip.upload')"
        class="h-8 shrink-0 rounded-lg px-2.5 text-[13px] text-primary-warm-white ring-1 ring-transparency-white-t20 transition-colors ring-inset hover:bg-transparency-white-t8 focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
        @click="input?.click()"
      >
        {{ t('reshoot.clip.replace') }}
      </button>
      <input
        ref="input"
        type="file"
        accept="video/*"
        class="sr-only"
        tabindex="-1"
        :aria-label="t('reshoot.clip.upload')"
        @change="choose"
      />
    </div>
    <p
      v-if="rejected"
      role="alert"
      data-testid="reshoot-clip-rejected"
      class="px-1 text-xs/relaxed text-primary-warm-white"
    >
      {{ rejected }}
    </p>
  </div>
</template>
