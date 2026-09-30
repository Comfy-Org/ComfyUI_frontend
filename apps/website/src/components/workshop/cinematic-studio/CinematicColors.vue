<script setup lang="ts">
import { Plus, Star, X } from '@lucide/vue'
import { ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../../i18n/translations'
import { MAX_COLORS } from '../../../lib/workshop/cinematic-studio/colors'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import CinematicColorPicker from './CinematicColorPicker.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const colors = defineModel<readonly string[]>({ required: true })
const main = defineModel<number | undefined>('main')

const active = ref(0)

const t = (key: Parameters<typeof tc>[0]) => tc(key, locale)

function setColor(index: number, value: string) {
  colors.value = colors.value.map((color, at) => (at === index ? value : color))
}

function remove(index: number) {
  colors.value = colors.value.filter((_, at) => at !== index)
  active.value = Math.min(active.value, colors.value.length - 1)
  if (main.value === index) main.value = undefined
  else if (main.value !== undefined && main.value > index) main.value -= 1
}

function add() {
  if (colors.value.length >= MAX_COLORS) return
  colors.value = [...colors.value, colors.value.at(-1) ?? '#808080']
  active.value = colors.value.length - 1
}

function toggleMain(index: number) {
  main.value = main.value === index ? undefined : index
}

function clear() {
  colors.value = []
  main.value = undefined
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
    <div class="flex flex-wrap items-center gap-2">
      <div v-for="(color, index) in colors" :key="index" class="group relative">
        <button
          type="button"
          :class="
            cn(
              'block size-9 rounded-lg ring-1 ring-transparency-white-t20 outline-none ring-inset focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow',
              active === index && 'ring-2 ring-primary-warm-white'
            )
          "
          :style="{ backgroundColor: color }"
          :aria-label="`${t('cinematic.colors.color')} ${index + 1}: ${color}`"
          :aria-pressed="active === index"
          @click="active = index"
        />
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
    <CinematicColorPicker
      v-if="colors[active]"
      :model-value="colors[active]"
      :locale
      @update:model-value="setColor(active, $event)"
    />
  </section>
</template>
