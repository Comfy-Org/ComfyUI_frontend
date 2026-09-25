<script setup lang="ts">
import { computed } from 'vue'
import type { Locale } from '../../../i18n/translations'
import type { CinematicCatalogEntry } from '../../../lib/workshop/cinematic-studio/model-catalog'
import type { ModelCapability } from '../../../lib/workshop/cinematic-studio/model-capabilities'
import { videoDurationGuidance } from '../../../lib/workshop/cinematic-studio/model-capabilities'
import { modelGuidanceCopy } from '../../../lib/workshop/cinematic-studio/model-guidance-copy'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
const { entry, timing, locale } = defineProps<{
  entry: CinematicCatalogEntry
  timing?: { count: number; median: number; min: number; max: number }
  locale: Locale
}>()
const guidanceCopy = computed(() => modelGuidanceCopy(locale))
function seconds(ms: number) {
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'second',
    unitDisplay: 'short',
    maximumFractionDigits: 0
  }).format(ms / 1000)
}
const capabilityLabels: Readonly<
  Partial<
    Record<
      ModelCapability['kind'],
      Readonly<Record<string, Parameters<typeof tc>[0]>>
    >
  >
> = {
  firstFrame: {
    required: 'cinematic.capability.required',
    optional: 'cinematic.capability.optional',
    supported: 'cinematic.capability.supported',
    unsupported: 'cinematic.capability.unsupported'
  },
  lastFrame: {
    required: 'cinematic.capability.required',
    optional: 'cinematic.capability.optional',
    supported: 'cinematic.capability.supported',
    unsupported: 'cinematic.capability.unsupported'
  },
  inputs: {
    text: 'cinematic.catalog.text',
    image: 'cinematic.catalog.image',
    video: 'cinematic.catalog.video',
    audio: 'cinematic.catalog.audio'
  },
  quality: {
    std: 'cinematic.video.standard',
    pro: 'cinematic.video.professional'
  },
  audio: {
    on: 'cinematic.video.audioOn',
    true: 'cinematic.video.audioOn',
    off: 'cinematic.video.audioOff',
    false: 'cinematic.video.audioOff'
  }
}
function capabilityValue(row: ModelCapability) {
  if (row.kind === 'duration')
    return videoDurationGuidance([row], locale).supported
  return row.values
    .map((value) => {
      const key = capabilityLabels[row.kind]?.[value]
      return key ? tc(key, locale) : value
    })
    .join(' / ')
}
</script>

<template>
  <details class="mt-3 text-sm text-primary-warm-white">
    <summary
      class="cursor-pointer rounded-lg border border-transparency-white-t20 px-3 py-2 text-primary-comfy-yellow"
    >
      {{ guidanceCopy.details }}
    </summary>
    <dl class="mt-3 grid grid-cols-1 gap-2 text-xs">
      <div v-for="row in entry.capabilities" :key="row.kind">
        <dt class="text-primary-warm-gray">
          {{ tc(`cinematic.capability.${row.kind}`, locale) }}
        </dt>
        <dd class="mt-0.5 wrap-break-word">
          {{ capabilityValue(row) }}
        </dd>
      </div>
    </dl>
    <p
      v-if="!entry.capabilities.length"
      class="mt-2 text-xs text-primary-warm-gray"
    >
      {{ tc('cinematic.capability.unknown', locale) }}
    </p>
    <p class="mt-2 text-xs text-primary-warm-gray">
      {{ tc('cinematic.capability.note', locale) }}
    </p>
    <div class="mt-3 border-t border-transparency-white-t8 pt-3">
      <p class="font-medium">
        {{ guidanceCopy.waitTime }}
      </p>
      <template v-if="timing">
        <p class="mt-1">
          {{
            tc(
              timing.count >= 3
                ? 'cinematic.timing.typical'
                : 'cinematic.timing.observed',
              locale
            )
          }}: {{ seconds(timing.median) }}
        </p>
        <p class="mt-1 text-xs text-primary-warm-gray">
          {{ tc('cinematic.timing.range', locale) }}:
          {{ seconds(timing.min) }} – {{ seconds(timing.max) }} ·
          {{ timing.count }}
          {{ tc('cinematic.timing.runs', locale) }}
        </p>
      </template>
      <p v-else class="mt-1">
        {{ tc('cinematic.timing.unmeasured', locale) }}
      </p>
      <p class="mt-2 text-xs text-primary-warm-gray">
        {{ tc('cinematic.timing.note', locale) }}
      </p>
    </div>
  </details>
</template>
