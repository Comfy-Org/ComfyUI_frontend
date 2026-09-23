<template>
  <template v-if="!sceneHasImage || hdriPath">
    <button
      v-tooltip.bottom="
        tip(
          hdriPath ? t('load3d.hdri.changeFile') : t('load3d.hdri.uploadFile')
        )
      "
      :class="actionClass(false)"
      type="button"
      :aria-label="
        compact
          ? hdriPath
            ? t('load3d.hdri.changeFile')
            : t('load3d.hdri.uploadFile')
          : undefined
      "
      @click="hdriFileRef?.click()"
    >
      <i class="icon-[lucide--upload] size-4" />
      <span v-if="!compact">{{
        hdriPath ? t('load3d.hdri.changeFile') : t('load3d.hdri.uploadFile')
      }}</span>
    </button>
    <input
      ref="hdriFileRef"
      type="file"
      :accept="SUPPORTED_HDRI_EXTENSIONS_ACCEPT"
      class="pointer-events-none absolute size-0 opacity-0"
      @change="onHdriFilePicked"
    />
  </template>

  <template v-if="hdriPath">
    <button
      v-tooltip.bottom="tip(t('load3d.hdri.label'))"
      :class="actionClass(hdriEnabled)"
      :aria-pressed="hdriEnabled"
      type="button"
      :aria-label="compact ? t('load3d.hdri.label') : undefined"
      @click="toggleHdriEnabled"
    >
      <i class="icon-[lucide--globe] size-4" />
      <span v-if="!compact">{{ t('load3d.hdri.label') }}</span>
    </button>
    <button
      v-tooltip.bottom="tip(t('load3d.hdri.showAsBackground'))"
      :class="actionClass(hdriShowAsBackground)"
      :aria-pressed="hdriShowAsBackground"
      type="button"
      :aria-label="compact ? t('load3d.hdri.showAsBackground') : undefined"
      @click="toggleHdriShowAsBackground"
    >
      <i class="icon-[lucide--image] size-4" />
      <span v-if="!compact">{{ t('load3d.hdri.showAsBackground') }}</span>
    </button>
    <button
      v-tooltip.bottom="tip(t('load3d.hdri.removeFile'))"
      :class="actionClass(false)"
      type="button"
      :aria-label="compact ? t('load3d.hdri.removeFile') : undefined"
      @click="removeHdri"
    >
      <i class="icon-[lucide--x] size-4" />
      <span v-if="!compact">{{ t('load3d.hdri.removeFile') }}</span>
    </button>
  </template>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { actionClass, tip } from '@/components/load3d/menubar/menuBarStyles'
import {
  SUPPORTED_HDRI_EXTENSIONS,
  SUPPORTED_HDRI_EXTENSIONS_ACCEPT
} from '@/extensions/core/load3d/constants'
import type { LightConfig } from '@/extensions/core/load3d/interfaces'
import { useToastStore } from '@/platform/updates/common/toastStore'

const { compact = false, sceneHasImage = false } = defineProps<{
  compact?: boolean
  sceneHasImage?: boolean
}>()

const config = defineModel<LightConfig>('config')

const emit = defineEmits<{
  (e: 'updateHdriFile', file: File | null): void
}>()

const { t } = useI18n()

const hdriPath = computed(() => config.value?.hdri?.hdriPath ?? '')
const hdriEnabled = computed(() => config.value?.hdri?.enabled ?? false)
const hdriShowAsBackground = computed(
  () => config.value?.hdri?.showAsBackground ?? false
)

const hdriFileRef = ref<HTMLInputElement | null>(null)

function onHdriFilePicked(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  input.value = ''
  if (file) {
    const ext = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
    if (!SUPPORTED_HDRI_EXTENSIONS.has(ext)) {
      useToastStore().addAlert(t('toastMessages.unsupportedHDRIFormat'))
      return
    }
  }
  emit('updateHdriFile', file)
}

function toggleHdriEnabled() {
  const hdri = config.value?.hdri
  if (hdri) hdri.enabled = !hdri.enabled
}

function toggleHdriShowAsBackground() {
  const hdri = config.value?.hdri
  if (hdri) hdri.showAsBackground = !hdri.showAsBackground
}

function removeHdri() {
  emit('updateHdriFile', null)
}
</script>
