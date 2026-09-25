<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import { tcEditing } from '../../../lib/workshop/cinematic-studio/editing-copy'

import type { EditingCopyKey } from '../../../lib/workshop/cinematic-studio/editing-copy'

import { computed } from 'vue'

import type { AssetReference } from '../../../lib/workshop/cinematic-studio/assets'

import type { CameraGuidance,cameraGuidancePlan } from '../../../lib/workshop/cinematic-studio/camera-guidance'


import type { cameraViewDefaults } from '../../../lib/workshop/cinematic-studio/editing'
import { cameraViewOptions } from '../../../lib/workshop/cinematic-studio/editing'

const { assets, sourceName, referenceMax, guidancePlan, fieldClass, locale } =
  defineProps<{
    assets: readonly AssetReference[]
    sourceName: string
    referenceMax: number
    guidancePlan?: ReturnType<typeof cameraGuidancePlan>
    fieldClass: string
    locale: Locale
  }>()

const camera = defineModel<typeof cameraViewDefaults>('camera', {
  required: true
})

const guidance = defineModel<CameraGuidance>('guidance', { required: true })

const emit = defineEmits<{
  changeGuidance: []
  chooseAsset: [string, Event]
  buildInstruction: []
}>()

const eligibleAssets = computed(() =>
  assets.filter(
    (asset) => guidance.value.mode !== 'portrait' || asset.kind === 'character'
  )
)

const modeNote = computed(
  () =>
    (
      ({
        portrait: 'portraitNote',
        anchored: 'anchoredNote',
        frame: 'frameNote'
      }) as const
    )[guidance.value.mode]
)

const anchoredUnavailable = computed(() => !assets.length || referenceMax < 2)

const portraitUnavailable = computed(
  () => !assets.some((asset) => asset.kind === 'character')
)

const orderedReferences = computed(() => {
  const portrait = guidance.value.mode === 'portrait'

  const names = (guidancePlan?.assets ?? []).map(
    (asset, index) => `${index + (portrait ? 1 : 2)}. ${asset.name}`
  )

  return [portrait ? '' : `1. ${sourceName}`, ...names]
    .filter(Boolean)
    .join(' · ')
})

const t = (key: EditingCopyKey) => tcEditing(key, locale)
</script>

<template>
  <fieldset
    class="flex min-w-0 flex-col gap-3 rounded-lg border border-transparency-white-t20 p-3"
  >
    <legend class="px-1 text-sm">{{ t('guidance') }}</legend>

    <label class="flex flex-col gap-2 text-sm"
      >{{ t('guidanceMode')
      }}<select
        v-model="guidance.mode"
        :class="fieldClass"
        @change="emit('changeGuidance')"
      >
        <option value="frame">{{ t('frameGuidance') }}</option>

        <option value="anchored" :disabled="anchoredUnavailable">
          {{ t('anchoredGuidance') }}
        </option>

        <option value="portrait" :disabled="portraitUnavailable">
          {{ t('portraitGuidance') }}
        </option>
      </select></label
    >

    <p class="text-xs text-primary-comfy-canvas">
      {{ t(modeNote) }}
    </p>

    <template v-if="guidance.mode !== 'frame'">
      <label
        v-for="asset in eligibleAssets"
        :key="asset.id"
        class="flex items-start gap-2 text-sm"
        ><input
          :type="guidance.mode === 'portrait' ? 'radio' : 'checkbox'"
          name="camera-guidance-asset"
          :checked="guidance.assetIds.includes(asset.id)"
          @change="emit('chooseAsset', asset.id, $event)"
        /><span class="min-w-0 wrap-break-word"
          >{{ asset.name
          }}<small class="block text-primary-comfy-canvas">{{
            asset.notes
          }}</small></span
        ></label
      >
    </template>

    <label
      v-if="guidance.mode === 'portrait'"
      class="flex flex-col gap-2 text-sm"
      >{{ t('rebuildScene')
      }}<textarea
        v-model="guidance.scene"
        :class="fieldClass"
        rows="3"
        maxlength="1500"
        @input="emit('buildInstruction')"
      />
    </label>

    <label class="flex flex-col gap-2 text-sm"
      >{{ t('preserveNotes')
      }}<textarea
        v-model="guidance.notes"
        :class="fieldClass"
        rows="2"
        maxlength="750"
        @input="emit('buildInstruction')"
      />
    </label>

    <p v-if="guidancePlan" class="text-xs text-primary-comfy-canvas">
      {{ t('orderedReferences') }}:

      {{ orderedReferences }}
    </p>

    <p v-else role="alert" class="text-xs">
      {{ t('guidanceInvalid') }} {{ t('referenceCapacity') }}:

      {{ referenceMax }}
    </p>

    <p v-if="!assets.length" class="text-xs text-primary-comfy-canvas">
      {{ t('noAssets') }}
    </p>
  </fieldset>

  <div class="grid gap-3 sm:grid-cols-3">
    <label class="flex flex-col gap-2 text-sm"
      >{{ t('azimuth')
      }}<select
        v-model="camera.azimuth"
        :class="fieldClass"
        @change="emit('buildInstruction')"
      >
        <option
          v-for="option in cameraViewOptions.azimuth"
          :key="option.id"
          :value="option.id"
        >
          {{ t(option.id) }}
        </option>
      </select></label
    >

    <label class="flex flex-col gap-2 text-sm"
      >{{ t('elevation')
      }}<select
        v-model="camera.elevation"
        :class="fieldClass"
        @change="emit('buildInstruction')"
      >
        <option
          v-for="option in cameraViewOptions.elevation"
          :key="option.id"
          :value="option.id"
        >
          {{ t(option.id) }}
        </option>
      </select></label
    >

    <label class="flex flex-col gap-2 text-sm"
      >{{ t('distance')
      }}<select
        v-model="camera.distance"
        :class="fieldClass"
        @change="emit('buildInstruction')"
      >
        <option
          v-for="option in cameraViewOptions.distance"
          :key="option.id"
          :value="option.id"
        >
          {{ t(option.id) }}
        </option>
      </select></label
    >
  </div>

  <p class="text-xs/relaxed text-primary-comfy-canvas">
    {{ t('cameraNote') }}
  </p>
</template>
