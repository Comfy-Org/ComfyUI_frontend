<template>
  <div v-if="!hasBackgroundImage || hdriConfig?.hdriPath" class="flex flex-col">
    <Button
      v-tooltip.right="{
        value: hdriConfig?.hdriPath
          ? $t('load3d.hdri.changeFile')
          : $t('load3d.hdri.uploadFile'),
        showDelay: 300
      }"
      size="icon"
      variant="textonly"
      class="rounded-full"
      :aria-label="
        hdriConfig?.hdriPath
          ? $t('load3d.hdri.changeFile')
          : $t('load3d.hdri.uploadFile')
      "
      @click="triggerFileInput"
    >
      <i class="icon-[lucide--upload] text-lg text-base-foreground" />
    </Button>

    <template v-if="hdriConfig?.hdriPath">
      <Button
        v-tooltip.right="{
          value: $t('load3d.hdri.label'),
          showDelay: 300
        }"
        size="icon"
        variant="textonly"
        :class="
          cn('rounded-full', hdriConfig?.enabled && 'ring-2 ring-white/50')
        "
        :aria-label="$t('load3d.hdri.label')"
        @click="toggleEnabled"
      >
        <i class="icon-[lucide--globe] text-lg text-base-foreground" />
      </Button>

      <Button
        v-tooltip.right="{
          value: $t('load3d.hdri.showAsBackground'),
          showDelay: 300
        }"
        size="icon"
        variant="textonly"
        :class="
          cn(
            'rounded-full',
            hdriConfig?.showAsBackground && 'ring-2 ring-white/50'
          )
        "
        :aria-label="$t('load3d.hdri.showAsBackground')"
        @click="toggleShowAsBackground"
      >
        <i class="icon-[lucide--image] text-lg text-base-foreground" />
      </Button>

      <Button
        v-tooltip.right="{
          value: $t('load3d.hdri.removeFile'),
          showDelay: 300
        }"
        size="icon"
        variant="textonly"
        class="rounded-full"
        :aria-label="$t('load3d.hdri.removeFile')"
        @click="onRemoveHDRI"
      >
        <i class="icon-[lucide--x] text-lg text-base-foreground" />
      </Button>
    </template>

    <input
      ref="fileInputRef"
      type="file"
      class="hidden"
      :accept="SUPPORTED_HDRI_EXTENSIONS_ACCEPT"
      @change="onFileChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import {
  SUPPORTED_HDRI_EXTENSIONS,
  SUPPORTED_HDRI_EXTENSIONS_ACCEPT
} from '@/extensions/core/load3d/constants'
import type { HDRIConfig } from '@/extensions/core/load3d/interfaces'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { cn } from '@/utils/tailwindUtil'

const { t } = useI18n()

const { hasBackgroundImage = false } = defineProps<{
  hasBackgroundImage?: boolean
}>()

const hdriConfig = defineModel<HDRIConfig>('hdriConfig')

const emit = defineEmits<{
  (e: 'updateHdriFile', file: File | null): void
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)

function triggerFileInput() {
  fileInputRef.value?.click()
}

function onFileChange(event: Event) {
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

function toggleEnabled() {
  if (!hdriConfig.value) return
  hdriConfig.value = {
    ...hdriConfig.value,
    enabled: !hdriConfig.value.enabled
  }
}

function toggleShowAsBackground() {
  if (!hdriConfig.value) return
  hdriConfig.value = {
    ...hdriConfig.value,
    showAsBackground: !hdriConfig.value.showAsBackground
  }
}

function onRemoveHDRI() {
  emit('updateHdriFile', null)
}
</script>
