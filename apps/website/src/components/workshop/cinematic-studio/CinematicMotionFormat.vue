<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import type { CinematicModel } from '../../../lib/workshop/cinematic-studio/models'
import type { AspectRatio } from '../../../lib/workshop/cinematic-studio/catalog'
import { tcMotionComparison } from '../../../lib/workshop/cinematic-studio/motion-comparison-copy'
import type { MotionComparisonCopyKey } from '../../../lib/workshop/cinematic-studio/motion-comparison-copy'
const { selected, resolutions, field, locale } = defineProps<{
  selected?: CinematicModel
  resolutions: readonly string[]
  field: string
  locale: Locale
}>()
const t = (key: MotionComparisonCopyKey) => tcMotionComparison(key, locale)
const duration = defineModel<number>('duration', { required: true })
const resolution = defineModel<string>('resolution', { required: true })
const aspect = defineModel<AspectRatio>('aspect', { required: true })
const audio = defineModel<boolean>('audio', { required: true })
const seedText = defineModel<string>('seedText', { required: true })
</script>

<template>
  <div v-if="selected?.video" class="grid gap-3 sm:grid-cols-2">
    <label class="text-sm"
      >{{ t('duration')
      }}<select v-model="duration" :class="field">
        <option v-for="value in selected.video.durations" :key="value" :value>
          {{ value }}
        </option>
      </select></label
    >
    <label class="text-sm"
      >{{ t('resolution')
      }}<select v-model="resolution" :class="field">
        <option v-for="value in resolutions" :key="value" :value>
          {{ value }}
        </option>
      </select></label
    >
    <label v-if="selected.video.aspects.length" class="text-sm"
      >{{ t('aspect')
      }}<select v-model="aspect" :class="field">
        <option v-for="value in selected.video.aspects" :key="value" :value>
          {{ value }}
        </option>
      </select></label
    >
    <p v-else class="text-xs text-primary-comfy-canvas">
      {{ t('sourceAspect') }}
    </p>
    <label
      v-if="selected.video.generateAudio"
      class="flex items-center gap-2 text-sm"
      ><input v-model="audio" type="checkbox" />{{ t('audio') }}</label
    >
    <label v-if="selected.seed" class="text-sm"
      >{{ t('seed')
      }}<input
        v-model="seedText"
        type="number"
        :min="selected.seed.minimum"
        :max="selected.seed.maximum"
        :step="selected.seed.step"
        :class="field"
    /></label>
  </div>
</template>
