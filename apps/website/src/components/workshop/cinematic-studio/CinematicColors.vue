<script setup lang="ts">
import { ImageIcon, Plus, Star, X } from '@lucide/vue'
import { nextTick, ref, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../../i18n/translations'
import {
  MAX_COLORS,
  sampleImageColors
} from '../../../lib/workshop/cinematic-studio/colors'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const colors = defineModel<readonly string[]>({ required: true })
const main = defineModel<number | undefined>('main')

const swatches = useTemplateRef<HTMLElement>('swatches')
const sampleInput = useTemplateRef<HTMLInputElement>('sampleInput')
const sampling = ref(false)
const sampleError = ref(false)

const t = (key: Parameters<typeof tc>[0]) => tc(key, locale)

function setColor(index: number, value: string) {
  colors.value = colors.value.map((color, at) => (at === index ? value : color))
}

function remove(index: number) {
  colors.value = colors.value.filter((_, at) => at !== index)
  if (main.value === index) main.value = undefined
  else if (main.value !== undefined && main.value > index) main.value -= 1
}

async function add() {
  if (colors.value.length >= MAX_COLORS) return
  colors.value = [...colors.value, colors.value.at(-1) ?? '#808080']
  await nextTick()
  swatches.value
    ?.querySelectorAll<HTMLInputElement>('input[type="color"]')
    [colors.value.length - 1]?.click()
}

function toggleMain(index: number) {
  main.value = main.value === index ? undefined : index
}

function clear() {
  colors.value = []
  main.value = undefined
  sampleError.value = false
}

async function sample(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  const [file] = target.files ?? []
  target.value = ''
  if (!file) return
  sampling.value = true
  sampleError.value = false
  try {
    colors.value = await sampleImageColors(file)
    main.value = undefined
  } catch {
    sampleError.value = true
  } finally {
    sampling.value = false
  }
}
</script>

<template>
  <section
    :aria-label="t('cinematic.colors.title')"
    class="flex flex-col gap-2 rounded-xl border border-transparency-white-t8 p-2.5"
  >
    <div class="flex items-center justify-between gap-2">
      <span
        class="text-[10px] font-bold tracking-widest text-primary-comfy-canvas uppercase"
      >
        {{ t('cinematic.colors.title') }} · {{ colors.length }}/{{ MAX_COLORS }}
      </span>
      <div class="flex items-center gap-1">
        <button
          type="button"
          class="flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs text-primary-warm-white hover:bg-transparency-white-t8 disabled:opacity-50"
          :disabled="sampling"
          @click="sampleInput?.click()"
        >
          <ImageIcon class="size-3.5" aria-hidden="true" />
          {{ t('cinematic.colors.sample') }}
        </button>
        <button
          v-if="colors.length"
          type="button"
          class="grid size-7 place-items-center rounded-lg text-primary-warm-gray hover:bg-transparency-white-t8 hover:text-primary-warm-white"
          :aria-label="t('cinematic.colors.clear')"
          @click="clear"
        >
          <X class="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
    <div ref="swatches" class="flex flex-wrap items-center gap-2">
      <div v-for="(color, index) in colors" :key="index" class="group relative">
        <label
          :class="
            cn(
              'block size-9 cursor-pointer rounded-lg ring-1 ring-transparency-white-t20 ring-inset focus-within:ring-2 focus-within:ring-primary-comfy-yellow',
              main === index && 'ring-2 ring-primary-warm-white'
            )
          "
          :style="{ backgroundColor: color }"
        >
          <input
            type="color"
            :value="color"
            class="sr-only"
            :aria-label="`${t('cinematic.colors.color')} ${index + 1}: ${color}`"
            @input="setColor(index, ($event.target as HTMLInputElement).value)"
          />
        </label>
        <button
          type="button"
          :class="
            cn(
              'absolute -bottom-1.5 -left-1.5 grid size-5 place-items-center rounded-full bg-primary-comfy-ink text-primary-warm-gray hover:text-primary-warm-white focus-visible:opacity-100',
              main === index
                ? 'text-primary-comfy-yellow opacity-100'
                : 'opacity-0 group-hover:opacity-100'
            )
          "
          :aria-label="`${t('cinematic.colors.makeMain')}: ${index + 1}`"
          :aria-pressed="main === index"
          @click="toggleMain(index)"
        >
          <Star
            :class="cn('size-3', main === index && 'fill-current')"
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          class="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-primary-comfy-ink text-primary-warm-gray opacity-0 group-hover:opacity-100 hover:text-primary-warm-white focus-visible:opacity-100"
          :aria-label="`${t('cinematic.colors.remove')} ${index + 1}`"
          @click="remove(index)"
        >
          <X class="size-3" aria-hidden="true" />
        </button>
      </div>
      <button
        v-if="colors.length < MAX_COLORS"
        type="button"
        class="grid size-9 place-items-center rounded-lg border border-dashed border-transparency-white-t20 text-primary-warm-gray hover:border-primary-warm-white/50 hover:text-primary-warm-white"
        :aria-label="t('cinematic.colors.add')"
        @click="add"
      >
        <Plus class="size-4" aria-hidden="true" />
      </button>
    </div>
    <p
      v-if="sampleError"
      role="status"
      class="text-xs text-primary-comfy-canvas"
    >
      {{ t('cinematic.colors.sampleError') }}
    </p>
    <p v-else class="text-xs text-primary-warm-gray">
      {{ t('cinematic.colors.hint') }}
    </p>
    <input
      ref="sampleInput"
      type="file"
      accept="image/png,image/jpeg,image/webp"
      data-testid="cinematic-colors-sample"
      class="sr-only"
      tabindex="-1"
      aria-hidden="true"
      @change="sample"
    />
  </section>
</template>
