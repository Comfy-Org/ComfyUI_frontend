<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { Locale } from '../../../i18n/translations'
import type { SavedAsset } from '../../../lib/workshop/cinematic-studio/assets'
import { ASSET_KINDS } from '../../../lib/workshop/cinematic-studio/assets'
import { tcAssets } from '../../../lib/workshop/cinematic-studio/assets-copy'
import type { AssetCopyKey } from '../../../lib/workshop/cinematic-studio/assets-copy'
import Button from '../../ui/button/Button.vue'
const {
  preview,
  cropStyle,
  size,
  busy,
  bounds,
  valid,
  guide,
  fieldClass,
  locale
} = defineProps<{
  preview: string
  cropStyle: CSSProperties
  size: { width: number; height: number }
  busy: boolean
  bounds: boolean
  valid: boolean
  guide: AssetCopyKey
  fieldClass: string
  locale: Locale
}>()
const draft = defineModel<SavedAsset>('draft', { required: true })
const crop = defineModel<{
  x: number
  y: number
  width: number
  height: number
}>('crop', { required: true })
const emit = defineEmits<{ save: []; applyCrop: []; clearDraft: [] }>()
const t = (key: AssetCopyKey) => tcAssets(key, locale)
</script>
<template>
  <form
    class="grid min-w-0 gap-4 rounded-xl border border-transparency-white-t20 p-4 text-primary-warm-white sm:grid-cols-2"
    @submit.prevent="emit('save')"
  >
    <div class="flex min-w-0 flex-col gap-3">
      <div class="relative overflow-hidden rounded-lg">
        <img :src="preview" :alt="t('preview')" class="block w-full" />
        <div
          class="pointer-events-none absolute border-2 border-primary-comfy-yellow"
          :style="cropStyle"
        />
      </div>
      <details>
        <summary class="cursor-pointer text-sm">{{ t('crop') }}</summary>
        <p class="my-2 text-xs text-primary-comfy-canvas">
          {{ t('cropHint') }}
        </p>
        <div class="grid grid-cols-2 gap-2">
          <label
            v-for="key in ['x', 'y', 'width', 'height'] as const"
            :key="key"
            class="flex flex-col gap-1 text-xs"
            >{{ t(key)
            }}<input
              v-model.number="crop[key]"
              type="number"
              step="1"
              :min="key === 'x' || key === 'y' ? 0 : 1"
              :max="key === 'x' || key === 'width' ? size.width : size.height"
              :class="fieldClass"
              :disabled="busy"
          /></label>
        </div>
        <Button
          type="button"
          variant="outline"
          class="mt-3"
          :disabled="busy || !bounds"
          @click="emit('applyCrop')"
          >{{ t('applyCrop') }}</Button
        >
      </details>
    </div>
    <div class="flex min-w-0 flex-col gap-3">
      <label class="flex flex-col gap-2 text-sm"
        >{{ t('name')
        }}<input
          v-model="draft.name"
          maxlength="60"
          required
          :disabled="busy"
          :class="fieldClass"
      /></label>
      <label class="flex flex-col gap-2 text-sm"
        >{{ t('kind')
        }}<select
          v-model="draft.kind"
          :aria-label="t('kind')"
          :disabled="busy"
          :class="fieldClass"
        >
          <option v-for="kind in ASSET_KINDS" :key="kind" :value="kind">
            {{ t(kind) }}
          </option>
        </select></label
      >
      <p class="text-xs/relaxed text-primary-comfy-canvas">
        {{ t(guide) }}
      </p>
      <label class="flex flex-col gap-2 text-sm"
        >{{ t('notes')
        }}<textarea
          v-model="draft.notes"
          maxlength="500"
          rows="4"
          :disabled="busy"
          :class="fieldClass"
        />
      </label>
      <Button type="submit" :disabled="busy || !valid">{{ t('save') }}</Button
      ><Button
        type="button"
        variant="outline"
        :disabled="busy"
        @click="emit('clearDraft')"
        >{{ t('cancel') }}</Button
      >
    </div>
  </form>
</template>
