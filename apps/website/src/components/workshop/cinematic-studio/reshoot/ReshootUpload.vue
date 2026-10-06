<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'
import { Upload } from '@lucide/vue'
import { ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { clipFits } from '@/lib/workshop/cinematic-studio/reshoot'
import { fileSecondsOf } from '@/lib/workshop/cinematic-studio/reshoot-clip'
import type { Locale } from '@/i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ pick: [file: File] }>()

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
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  const file = input.files?.[0]
  input.value = ''
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
    <label
      :class="
        cn(
          'flex w-full cursor-pointer flex-col items-center gap-1.5 rounded-2xl border-[1.5px] border-dashed border-transparency-white-t20 bg-transparency-white-t4 px-4 py-5 text-center transition-colors focus-within:border-primary-comfy-yellow hover:border-primary-warm-white/40',
          over && 'border-primary-comfy-yellow bg-transparency-white-t8'
        )
      "
      data-testid="reshoot-upload"
      @dragover.prevent="over = true"
      @dragleave="over = false"
      @drop.prevent="drop"
    >
      <Upload class="size-6 text-primary-comfy-canvas" aria-hidden="true" />
      <span class="text-sm font-semibold text-primary-warm-white">
        {{ t('reshoot.clip.upload') }}
      </span>
      <span class="text-xs text-primary-warm-gray">
        {{ t('reshoot.clip.browse') }}
      </span>
      <span class="text-[11px]/relaxed text-balance text-primary-warm-gray">
        {{ t('reshoot.clip.help') }}
      </span>
      <input type="file" accept="video/*" class="sr-only" @change="choose" />
    </label>
    <p
      v-if="rejected"
      role="alert"
      data-testid="reshoot-clip-rejected"
      class="px-1 text-[11px]/relaxed text-primary-warm-white"
    >
      {{ rejected }}
    </p>
  </div>
</template>
