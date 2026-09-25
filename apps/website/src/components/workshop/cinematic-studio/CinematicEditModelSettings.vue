<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import { tcEditing } from '../../../lib/workshop/cinematic-studio/editing-copy'
import type { EditingCopyKey } from '../../../lib/workshop/cinematic-studio/editing-copy'
import type { CinematicModel } from '../../../lib/workshop/cinematic-studio/models'
import type { AspectRatio,ASPECT_RATIOS } from '../../../lib/workshop/cinematic-studio/catalog'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
const { models, aspectOptions, locale, fieldClass } = defineProps<{
  models: readonly CinematicModel[]
  aspectOptions: (typeof ASPECT_RATIOS)[number][]
  locale: Locale
  fieldClass: string
}>()
const modelSlug = defineModel<string>('modelSlug', { required: true })
const aspect = defineModel<AspectRatio>('aspect', { required: true })
const t = (key: EditingCopyKey) => tcEditing(key, locale)
</script>
<template>
  <div class="grid gap-3 sm:grid-cols-2">
    <label class="flex min-w-0 flex-col gap-2 text-sm"
      >{{ t('model')
      }}<select v-model="modelSlug" :class="fieldClass">
        <option v-for="model in models" :key="model.slug" :value="model.slug">
          {{ model.name }}
        </option>
      </select></label
    >
    <label class="flex min-w-0 flex-col gap-2 text-sm"
      >{{ t('aspect')
      }}<select v-model="aspect" :class="fieldClass">
        <option
          v-for="ratio in aspectOptions"
          :key="ratio.id"
          :value="ratio.id"
        >
          {{ ratio.id }} · {{ tc(ratio.label, locale) }}
        </option>
      </select></label
    >
  </div>
</template>
