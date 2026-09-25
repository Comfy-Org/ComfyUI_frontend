<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import type { AspectRatio } from '../../../lib/workshop/cinematic-studio/catalog'
import { ASPECT_RATIOS } from '../../../lib/workshop/cinematic-studio/catalog'
import type { CinematicModel } from '../../../lib/workshop/cinematic-studio/models'
import CinematicReferenceSlot from './CinematicReferenceSlot.vue'

const { model, locale = 'en' } = defineProps<{
  model: CinematicModel | undefined
  locale?: Locale
}>()
const aspect = defineModel<AspectRatio>('aspect', { required: true })
const duration = defineModel<number>('duration', { required: true })
const resolution = defineModel<string>('resolution', { required: true })
const audio = defineModel<boolean>('audio', { required: true })
const firstFrame = defineModel<File | undefined>('firstFrame')
const lastFrame = defineModel<File | undefined>('lastFrame')
const fieldClass =
  'mt-2 h-10 w-full rounded-xl border border-transparency-white-t20 bg-primary-comfy-ink px-3 text-sm text-primary-warm-white'
</script>

<template>
  <div v-if="model?.video" class="flex flex-col gap-4">
    <div class="grid grid-cols-2 gap-3">
      <label class="text-xs text-primary-comfy-canvas"
        >{{ tc('cinematic.video.duration', locale) }}
        <select v-model="duration" :class="fieldClass">
          <option
            v-for="value in model.video.durations"
            :key="value"
            :value="value"
          >
            {{ value }}s
          </option>
        </select>
      </label>
      <label class="text-xs text-primary-comfy-canvas"
        >{{ tc('cinematic.output.resolution', locale) }}
        <select v-model="resolution" :class="fieldClass">
          <option
            v-for="value in model.video.resolutions"
            :key="value"
            :value="value"
          >
            {{ value }}
          </option>
        </select>
      </label>
      <label class="text-xs text-primary-comfy-canvas"
        >{{ tc('cinematic.output.aspect', locale) }}
        <select v-model="aspect" :class="fieldClass">
          <option
            v-for="value in ASPECT_RATIOS.filter((item) =>
              model?.video?.aspects.includes(item.id)
            )"
            :key="value.id"
            :value="value.id"
          >
            {{ value.id }}
          </option>
        </select>
      </label>
      <label
        v-if="model.video.generateAudio"
        class="flex items-center gap-2 text-sm text-primary-warm-white"
        ><input v-model="audio" type="checkbox" />{{
          tc('cinematic.video.audio', locale)
        }}</label
      >
    </div>
    <div
      v-if="model.video.firstFrame !== 'unsupported'"
      class="grid grid-cols-2 gap-2"
    >
      <CinematicReferenceSlot v-model="firstFrame" kind="firstFrame" :locale />
      <CinematicReferenceSlot
        v-if="model.video.lastFrame"
        v-model="lastFrame"
        kind="lastFrame"
        :locale
      />
    </div>
    <p class="text-xs/relaxed text-primary-comfy-canvas">
      {{
        tc(
          model.video.firstFrame === 'required' && !firstFrame
            ? 'cinematic.video.needFrame'
            : 'cinematic.video.oneClip',
          locale
        )
      }}
    </p>
  </div>
  <p v-else class="text-sm text-primary-comfy-canvas">
    {{ tc('cinematic.output.unavailable', locale) }}
  </p>
</template>
